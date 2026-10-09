// 诊断重建差异：列出每个 edit 的 seq / 成功与否 / 行数增减 / 结果文本开头。
import fs from 'node:fs';

const sess = process.argv[2];
const lines = fs.readFileSync(sess, 'utf8').split('\n').filter(Boolean);
const callById = new Map();
const resultsById = new Map();
for (const l of lines) {
  let o;
  try {
    o = JSON.parse(l);
  } catch {
    continue;
  }
  const d = o.data || {};
  if (o.type === 'tool/call') callById.set(d.callId, { seq: o.seq, name: d.name, args: d.arguments });
  else if (o.type === 'tool/result') {
    const cid = d.message?.toolCallId;
    if (!cid) continue;
    const text = (d.message?.content || []).map((x) => x.text || '').join('');
    if (!resultsById.has(cid)) resultsById.set(cid, []);
    resultsById.get(cid).push({ seq: o.seq, text });
  }
}

const rows = [];
for (const [cid, c] of callById) {
  if (c.name !== 'edit') continue;
  let a;
  try {
    a = JSON.parse(c.args || '{}');
  } catch {
    continue;
  }
  if (!String(a.file_path || '').includes('styles.css')) continue;
  const res = (resultsById.get(cid) || []).map((r) => r.text).join('\n');
  const nl = (s) => (s ? s.split('\n').length : 0);
  rows.push({
    seq: c.seq,
    add: nl(a.new_string) - nl(a.old_string),
    resLen: res.length,
    head: res.slice(0, 60).replace(/\s+/g, ' '),
    empty: res.length === 0,
  });
}
rows.sort((a, b) => a.seq - b.seq);
console.log('seq | delta | resLen | result');
for (const r of rows) console.log(`${r.seq} | ${r.add >= 0 ? '+' : ''}${r.add} | ${r.resLen} | ${r.head}`);
console.log('total net lines:', rows.reduce((s, r) => s + r.add, 0));
console.log('edits with empty result (pruned):', rows.filter((r) => r.empty).map((r) => r.seq).join(', ') || 'none');
