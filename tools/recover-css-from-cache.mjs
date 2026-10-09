// 从 Edge CDP 的 HTTP 缓存里把 Vite 转译过的 styles.css 抢救回来。
//
// 缓存里那份是被 Vite 包成一个小 JS 模块的（__vite__css = "..."），
// 所以这里要把那个字符串字面量抠出来、按 JS/JSON 规则反转义，写回源文件。
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2];
const out = process.argv[3];

const text = readFileSync(src, 'utf8');
const marker = 'const __vite__css = ';
const start = text.indexOf(marker);
if (start === -1) throw new Error('找不到 __vite__css 标记');

// 从引号开始，逐字符扫到真正的收尾引号（要跳过转义）
let i = text.indexOf('"', start + marker.length);
if (i === -1) throw new Error('找不到字符串起始引号');
i += 1;
let j = i;
while (j < text.length) {
  const c = text[j];
  if (c === '\\') { j += 2; continue; }
  if (c === '"') break;
  j += 1;
}
const literal = text.slice(i, j);
const css = JSON.parse(`"${literal}"`);

writeFileSync(out, css, 'utf8');

// 自检：几个必须存在的锚点
const checks = {
  bytes: Buffer.byteLength(css, 'utf8'),
  lines: css.split('\n').length,
  rootVar: css.includes('--engrave'),
  armed: css.includes('.btn.halt.armed'),
  armedEdge: css.includes('#8a4630'),
  lampStrike: css.includes('lamp-strike'),
  sheetPlate: css.includes('.sheet-plate'),
  reduceBlock: css.includes('prefers-reduced-motion'),
  firstLine: css.split('\n')[0],
  lastLine: css.split('\n').filter((l) => l.trim()).pop(),
};
console.log(JSON.stringify(checks, null, 2));
