// 全库扫描：对每条记录跑一次渲染管线，找出「清洗之后仍然带圆角」的图形。
// 三类漏网都查：(a) <rect> 上残留 rx/ry；(b) rx/ry 写在 style 里；
// (c) 用 <path> 的圆弧命令画的圆角背景。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { sanitizeSvg } = await import('file://' + join(root, 'shared', 'svg.ts').replace(/\\/g, '/'));

const dir = join(root, 'data', 'records');
const files = [];
for (const d of readdirSync(dir)) {
  const p = join(dir, d);
  if (!statSync(p).isDirectory()) continue;
  for (const f of readdirSync(p)) if (f.endsWith('.svg')) files.push(join(p, f));
}
files.sort();

const out = [];
for (const f of files) {
  const raw = readFileSync(f, 'utf8');
  const clean = sanitizeSvg(raw);
  const rectsRaw = [...raw.matchAll(/<rect\b[^>]*>/gi)].map((m) => m[0]);
  const rectsClean = [...clean.matchAll(/<rect\b[^>]*>/gi)].map((m) => m[0]);
  const rectsWithRxRaw = rectsRaw.filter((r) => /\br[x|y]\b/i.test(r));
  const rectsWithRxClean = rectsClean.filter((r) => /\br[x|y]\b/i.test(r));
  // style 里藏圆角
  const styleRxRaw = [...raw.matchAll(/style\s*=\s*"[^"]*border-radius[^"]*"/gi)].map((m) => m[0]);
  // <path> 里的圆弧命令（A/a）——背景用 path 画圆角的可能
  const pathsWithArc = [...raw.matchAll(/<path\b[^>]*\bd\s*=\s*"([^"]*)"/gi)]
    .filter((m) => /[Aa]/.test(m[1]))
    .map((m) => m[1].slice(0, 90));
  // 其它任何带 rx/ry 的标签名
  const tagsWithRx = [...new Set([...clean.matchAll(/<(\w[\w:-]*)\b[^>]*\br[x|y]\s*=/gi)].map((m) => m[1].toLowerCase()))];

  if (rectsWithRxClean.length || styleRxRaw.length || pathsWithArc.length) {
    out.push({
      file: f.replace(root + '\\', ''),
      rectsWithRxRaw,
      rectsWithRxClean,
      styleRxRaw,
      pathsWithArc: pathsWithArc.slice(0, 4),
      tagsWithRx,
    });
  }
}

console.log(JSON.stringify({ scanned: files.length, offenders: out }, null, 2));
