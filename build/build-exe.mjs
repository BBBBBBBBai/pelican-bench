#!/usr/bin/env node
/**
 * 把整个应用打成一个 Windows 单文件 exe。
 *
 *   node build/build-exe.mjs            完整流程
 *   node build/build-exe.mjs --skip-web 跳过 Vite 构建（前端没改的时候省几秒）
 *
 * 步骤和 Node 官方的单文件应用（SEA）文档一一对应，只是把「打包脚本」「注入资源」
 * 这两步合并了：
 *
 *   1. Vite 构建前端          → dist/web/
 *   2. esbuild 把后端打成一份 CommonJS → build/server.cjs
 *      （SEA 目前只跑 CommonJS；顺带把 `await import('./openai.ts')` 这种带 .ts 后缀
 *        的动态导入也一起折进去了，那正是打包最容易踩的雷）
 *   3. 生成 sea-config.json：主脚本 + 把 dist/web 整个挂成 `web/…` 资源
 *   4. node --experimental-sea-config 生成 blob
 *   5. 复制一份官方 node.exe 当底子
 *   6. rcedit 换掉 node.exe 自带的图标与版本信息
 *   7. postject 把 blob 注进去
 *
 * 产物体积的下限就是那份 node.exe（约 88 MB）—— 前端那 443 KB 内嵌进去几乎不花钱。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { rcedit } from 'rcedit';

const require_ = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'build');
const WEB = path.join(ROOT, 'dist', 'web');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/** Node 官方给 SEA blob 留的定位标记，postject 靠它在二进制里找注入点。这个值是固定的。 */
const SENTINEL_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const skipWeb = process.argv.includes('--skip-web');
const step = (n, msg) => console.log(`\n[${n}] ${msg}`);
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, base));
    else if (entry.isFile()) out.push({ abs, rel: path.relative(base, abs).split(path.sep).join('/') });
  }
  return out;
}

// ------------------------------------------------------------------ 0

// 只清中间产物，别把这个脚本自己所在的目录整个删掉。
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) {
  if (f === path.basename(import.meta.filename)) continue;
  fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
}
console.log(`构建 pelican-bench ${pkg.version}（Node ${process.version}）`);

// ------------------------------------------------------------------ 1

if (skipWeb) {
  step(1, '跳过 Vite 构建');
  if (!fs.existsSync(path.join(WEB, 'index.html'))) {
    console.error('    dist/web/index.html 不存在，不能跳过 —— 去掉 --skip-web 再跑一次。');
    process.exit(1);
  }
} else {
  step(1, 'Vite 构建前端');
  execFileSync(
    process.execPath,
    [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--config', 'web/vite.config.ts'],
    { cwd: ROOT, stdio: 'inherit' },
  );
}
const webFiles = walk(WEB);
console.log(`    dist/web：${webFiles.length} 个文件，共 ${mb(webFiles.reduce((n, f) => n + fs.statSync(f.abs).size, 0))}`);

// ------------------------------------------------------------------ 2

step(2, 'esbuild 打包后端 → build/server.cjs');
await build({
  entryPoints: [path.join(ROOT, 'server', 'index.ts')],
  outfile: path.join(OUT, 'server.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  // 源码里的相对导入带 .ts 后缀（allowImportingTsExtensions），esbuild 自己认得。
  logLevel: 'info',
  // 只留一份许可证注释，别把每个依赖的 banner 都抄进来
  legalComments: 'none',
});
const serverCjs = path.join(OUT, 'server.cjs');
console.log(`    ${mb(fs.statSync(serverCjs).size)}`);

// ------------------------------------------------------------------ 3

step(3, '生成 sea-config.json');
const seaConfig = {
  main: serverCjs,
  output: path.join(OUT, 'sea-prep.blob'),
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
  assets: Object.fromEntries(webFiles.map((f) => [`web/${f.rel}`, f.abs])),
};
const seaConfigPath = path.join(OUT, 'sea-config.json');
fs.writeFileSync(seaConfigPath, `${JSON.stringify(seaConfig, null, 2)}\n`, 'utf8');
console.log(`    内嵌 ${Object.keys(seaConfig.assets).length} 份前端资源`);

// ------------------------------------------------------------------ 4

step(4, 'node --experimental-sea-config → blob');
execFileSync(process.execPath, ['--experimental-sea-config', seaConfigPath], { stdio: 'inherit' });
console.log(`    ${mb(fs.statSync(seaConfig.output).size)}`);

// ------------------------------------------------------------------ 5

step(5, '复制官方 node.exe 当底子');
// 平台写死 win-x64：Node 官方 SEA 没法真正交叉编译，得出 mac 版就得在 mac 上打。
const exeName = `pelican-bench-${pkg.version}-win-x64.exe`;
const exePath = path.join(OUT, exeName);
fs.copyFileSync(process.execPath, exePath);
console.log(`    ${path.basename(process.execPath)} → ${exeName}（${mb(fs.statSync(exePath).size)}）`);

// ------------------------------------------------------------------ 6

step(6, 'rcedit 换图标与版本信息');
// 必须在 postject 之前。rcedit 是重写 PE 的资源段，postject 是往文件尾部追加 blob；
// 反过来做，rcedit 那次重写有可能把注入好的 blob 一起抹掉。
// 不换的话，成品会顶着 node.exe 自带的图标，版本信息写着 "Node.js JavaScript Runtime"
// —— 一个自称 Node 却被改动过的 94 MB 二进制，正是杀软启发式爱看的形状。
const iconPath = path.join(ROOT, 'web', 'public', 'favicon.ico');
if (!fs.existsSync(iconPath)) {
  console.error(`    ${path.relative(ROOT, iconPath)} 不存在 —— 先跑 node assets/make-icons.mjs`);
  process.exit(1);
}
await rcedit(exePath, {
  icon: iconPath,
  // Windows 的版本资源是四段数字，补一段免得 rcedit 自己拿主意
  'file-version': `${pkg.version}.0`,
  'product-version': `${pkg.version}.0`,
  // 数据写在 %APPDATA%\PelicanBench，不需要管理员；也别去要，要了每次启动都弹 UAC
  'requested-execution-level': 'asInvoker',
  'version-string': {
    CompanyName: 'Pelican Bench',
    ProductName: 'Pelican Bench',
    FileDescription: 'Pelican Bench · 鹈鹕测试台',
    InternalName: 'pelican-bench',
    OriginalFilename: exeName,
    LegalCopyright: 'MIT License',
  },
});
console.log(`    ${path.relative(ROOT, iconPath)} → ${exeName}，版本 ${pkg.version}.0，asInvoker`);

// ------------------------------------------------------------------ 7

step(7, 'postject 注入');
const postjectDir = path.dirname(require_.resolve('postject/package.json'));
const postjectBin = JSON.parse(fs.readFileSync(path.join(postjectDir, 'package.json'), 'utf8')).bin.postject;
execFileSync(
  process.execPath,
  [
    path.join(postjectDir, postjectBin),
    exePath,
    'NODE_SEA_BLOB',
    seaConfig.output,
    '--sentinel-fuse',
    SENTINEL_FUSE,
  ],
  { stdio: 'inherit' },
);

// ------------------------------------------------------------------ 收尾

console.log(`\n成品：${exePath}`);
console.log(`体积：${mb(fs.statSync(exePath).size)}（其中 ${mb(fs.statSync(process.execPath).size)} 是 node.exe 本身）`);
console.log('未签名 —— 首次运行会被 SmartScreen 拦一下，见 README 的说明。');
