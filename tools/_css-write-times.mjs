// 带时间戳的 styles.css 写操作审计：确认缓存副本（20:01:31）之后、
// 截断（20:02:10）之前，有没有对 styles.css 的写入。
import { readFileSync } from 'node:fs';

for (const f of process.argv.slice(2)) {
  const lines = readFileSync(f, 'utf8').split('\n').filter(Boolean);
  console.log(`\n=== ${f} ===`);
  const rows = [];
  for (const l of lines) {
    let o;
    try {
      o = JSON.parse(l);
    } catch {
      continue;
    }
    const d = o.data || {};
    if (o.type !== 'tool/call') continue;
    const args = String(d.arguments || '');
    if (!/styles\.css/.test(args)) continue;
    if (!/^(edit|write)$/.test(d.name || '')) continue;
    rows.push({ seq: o.seq, time: o.time, name: d.name, len: args.length });
  }
  rows.sort((a, b) => a.seq - b.seq);
  console.log('styles.css write calls:', rows.length);
  for (const r of rows) {
    const t = r.time ? new Date(r.time).toISOString() : '(none)';
    console.log(`  seq ${String(r.seq).padStart(5)}  ${t}  ${r.name.padEnd(6)} args=${r.len}`);
  }
}
