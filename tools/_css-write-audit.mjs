// 关键问题：缓存里那份 CSS 是 20:01:31 的，事故发生在 20:02:10 ——
// 中间 39 秒里有没有对 styles.css 的写入？如果有，恢复的副本就缺了那一段。
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
const TARGET = /styles\.css/;

for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n').filter(Boolean);
  let hits = 0;
  for (const l of lines) {
    let o;
    try {
      o = JSON.parse(l);
    } catch {
      continue;
    }
    const d = o.data || {};
    if (o.type !== 'tool/call') continue;
    const args = d.arguments || '';
    if (!TARGET.test(args)) continue;
    if (!/edit|write/.test(d.name || '')) continue;
    // 只关心写操作
    hits++;
    const ts = o.ts ?? o.timestamp ?? d.ts ?? null;
    console.log(f.split(/[\\/]/).pop(), '| seq', o.seq, '|', d.name, '|', ts ?? '(no ts)', '|', String(args).slice(0, 110));
  }
  console.log(`--- ${f}: ${hits} styles.css write calls ---`);
}
