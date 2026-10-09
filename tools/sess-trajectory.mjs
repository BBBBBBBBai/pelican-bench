// 收集会话里针对某文件的所有「行数脚注」，重建真实行数轨迹。
//
// 两种脚注格式：
//   完整读取： (End of file - total N lines)
//   部分读取： (Showing lines X-Y of N. Use offset=Z to continue.)
// 只认「结果所属的 tool/call 确实读的是该文件」，避免别的文件的行数混进来。
import fs from 'node:fs';

const sess = process.argv[2];
const want = process.argv[3] || 'styles.css';

const raw = fs.readFileSync(sess, 'utf8').split('\n').filter(Boolean);
const callById = new Map();
for (const l of raw) {
  let o;
  try {
    o = JSON.parse(l);
  } catch {
    continue;
  }
  if (o.type === 'tool/call') callById.set(o.data.callId, { seq: o.seq, name: o.data.name, args: o.data.arguments });
}

const rows = [];
for (const l of raw) {
  let o;
  try {
    o = JSON.parse(l);
  } catch {
    continue;
  }
  if (o.type !== 'tool/result') continue;
  const d = o.data || {};
  const cid = d.message?.toolCallId;
  const c = callById.get(cid);
  if (!c) continue;
  let a = {};
  try {
    a = JSON.parse(c.args || '{}');
  } catch {}
  if (!String(a.file_path || '').includes(want)) continue;
  const t = (d.message?.content || []).map((x) => x.text || '').join('');
  const m1 = t.match(/\(End of file - total (\d+) lines\)/);
  const m2 = t.match(/\(Showing lines (\d+)-(\d+) of (\d+)\./);
  if (m1) rows.push({ seq: c.seq, kind: 'EOF', total: +m1[1], offset: null });
  else if (m2) rows.push({ seq: c.seq, kind: 'PARTIAL', total: +m2[3], offset: +m2[2] });
}
rows.sort((a, b) => a.seq - b.seq);
console.log(`footers for ${want}: ${rows.length}`);
for (const r of rows) console.log(`  seq ${r.seq}  ${r.kind}  total=${r.total}${r.offset ? ` (read through line ${r.offset})` : ''}`);
const totals = [...new Set(rows.map((r) => r.total))].sort((a, b) => a - b);
console.log('distinct totals:', totals.join(', '));
console.log('MAX total ever reported:', Math.max(...totals));
