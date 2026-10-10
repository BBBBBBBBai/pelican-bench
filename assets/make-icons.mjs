#!/usr/bin/env node
/**
 * 把一份 SVG 变成网页与 exe 要用的图标。
 *
 *   node assets/make-icons.mjs [源 svg]
 *   默认源：assets/pelican-logo.svg
 *
 * 产出（都会被提交进仓库）：
 *   web/public/favicon.svg          简化版，圆角外透明，给现代浏览器
 *   web/public/favicon.ico          多尺寸；小尺寸简化版，大尺寸完整版
 *   web/public/apple-touch-icon.png 180×180 简化版
 *
 * 只在本机跑：光栅化借 Edge 的无头截图，不引入任何 npm 依赖（要求 Windows + Edge）。
 * 和源图放在一起，跟着仓库走 —— 换图标时改 pelican-logo.svg 再跑一次就行。
 * 产物（favicon.svg / favicon.ico / apple-touch-icon.png）也一并提交，
 * 所以正常构建和使用都不需要跑这个脚本。
 *
 * 两个版式的取舍：
 *   完整版 保留辉光、内框细描边、两个 L 角标 —— 只有 64px 以上才看得出。
 *   简化版 只留圆角底板 + 鸟。16px 上辉光/内框/角标全糊成噪点，而鸟只占画布
 *          一半多一点，整个图标读起来就是「深色方块上有个小点」。所以小尺寸
 *          把版式丢掉，只保留认得出的那部分：鸟放大到填满底板。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUB = path.join(ROOT, 'web', 'public');
const SRC = process.argv[2] ?? path.join(ROOT, 'assets', 'pelican-logo.svg');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

/**
 * 鸟身 + 喉囊 + 眼珠 在 1254 画布里的包围盒，用浏览器 getBBox() 量出来，
 * 再把鸟缩放到填满底板（四周留 10%）。
 *   bbox = (200.8885, 274.0900, 811.4962, 653.8344)
 * 换源图必须重新量：把第 5/6/7 块包进 <g class="art"> 放进一个页面，
 * 用浏览器打开那个页面跑一次 getBBox() 即可。
 */
const FIT = 'translate(-122.9454 -115.9861) scale(1.236235)';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pelican-icons-'));

// ---------------------------------------------------------------- 拆源文件

const raw = fs.readFileSync(SRC, 'utf8');
const openEnd = raw.indexOf('>', raw.indexOf('<svg'));
const inner = raw.slice(openEnd + 1, raw.lastIndexOf('</svg>'));

// 按 `<!-- N. 说明 -->` 注释切块，比正则去匹配路径稳得多。
// 注意 <defs> 里面自己就带注释，所以「第几块」认的是 N. 开头的那种。
const firstBlock = inner.search(/<!--\s*1\./);
const defs = inner.slice(0, firstBlock < 0 ? inner.length : firstBlock);
const blocks = {};
for (const chunk of inner.split('<!--').slice(1)) {
  const end = chunk.indexOf('-->');
  if (end < 0) continue;
  blocks[chunk.slice(0, end).trim()[0]] = chunk.slice(end + 3);
}
const art = blocks['5'] + blocks['6'] + blocks['7']; // 鸟身 + 喉囊 + 眼珠

// 完整版：保留辉光、内框、L 角标，但拿掉最外层那块整黑底，让圆角外面真的是透明的
const FULL = inner.replace(/<rect width="1254" height="1254" fill="#000000"\/>/, '');

// 简化版：只留圆角底板 + 放大到填满的鸟
const SIMPLE =
  `<rect width="1254" height="1254" rx="204" ry="204" fill="#151412"/>` +
  `<g transform="${FIT}">${art}</g>`;

// ---------------------------------------------------------------- 光栅化

function render(variant, size) {
  const html =
    `<!doctype html><meta charset="utf-8"><style>` +
    `html,body{margin:0;padding:0;background:transparent;overflow:hidden}` +
    `svg{display:block}</style>` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1254 1254" ` +
    `width="${size}" height="${size}">${variant === 'S' ? SIMPLE : FULL}</svg>`;
  const page = path.join(TMP, `${variant}-${size}.html`);
  fs.writeFileSync(page, html, 'utf8');

  const png = path.join(TMP, `${variant}-${size}.png`);
  execFileSync(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--virtual-time-budget=3000',
      '--default-background-color=00000000', // 圆角外面必须真的是透明
      `--window-size=${size},${size}`,
      `--screenshot=${png}`,
      `file:///${page.replace(/\\/g, '/')}`,
    ],
    { stdio: 'pipe' },
  );
  if (!fs.existsSync(png)) throw new Error(`Edge 没吐出 ${png}`);
  return fs.readFileSync(png);
}

/** ICO 里每一条都可以直接装 PNG（Vista 以后支持），省掉自己写 BMP 的麻烦 */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  entries.forEach((e, i) => {
    const b = i * 16;
    // 256 在这里写 0 —— 一个字节装不下 256
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, b + 0); // width
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, b + 1); // height
    dir.writeUInt8(0, b + 2); // 调色板色数，真彩填 0
    dir.writeUInt8(0, b + 3); // reserved
    dir.writeUInt16LE(1, b + 4); // planes
    dir.writeUInt16LE(32, b + 6); // 位深
    dir.writeUInt32LE(e.png.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += e.png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

// ---------------------------------------------------------------- 跑

// 48 以下用简化版，64 以上用完整版 —— 真彩图标都这么干：
// 小尺寸只求认得出，大尺寸才谈得上版式。
const PLAN = [16, 24, 32, 48, 64, 128, 256].map((size) => ({
  size,
  variant: size <= 48 ? 'S' : 'F',
}));

console.log(`源：${path.relative(ROOT, SRC)}`);
const entries = [];
for (const { size, variant } of PLAN) {
  const png = render(variant, size);
  entries.push({ size, png });
  console.log(`    ${String(size).padStart(3)}px  ${variant === 'S' ? '简化版' : '完整版'}  ${png.length} B`);
}

fs.mkdirSync(PUB, { recursive: true });

const ico = buildIco(entries);
fs.writeFileSync(path.join(PUB, 'favicon.ico'), ico);
console.log(`\n写 favicon.ico          ${ico.length} B（${entries.length} 个尺寸）`);

// favicon.svg 用的是简化版：浏览器标签页就是 16px，而 SVG 版会被现代浏览器优先选中
const svgOut =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1254 1254" width="512" height="512">` +
  `${defs}${SIMPLE}</svg>\n`;
fs.writeFileSync(path.join(PUB, 'favicon.svg'), svgOut, 'utf8');
console.log(`写 favicon.svg          ${Buffer.byteLength(svgOut)} B`);

const touch = render('S', 180);
fs.writeFileSync(path.join(PUB, 'apple-touch-icon.png'), touch);
console.log(`写 apple-touch-icon.png ${touch.length} B（180×180）`);

fs.rmSync(TMP, { recursive: true, force: true });
console.log('\n好了。');
