// 打印指定 seq 的 read 结果全文（用来核对尾部 "(Showing lines X-Y of Z)" 这类脚注）。
import fs from 'node:fs';
const sess = process.argv[2];
const wants = process.argv.slice(3);
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
for (const [cid, c] of callById) {
  if (!wants.includes(String(c.seq))) continue;
  let a;
  try {
    a = JSON.parse(c.args || '{}');
  } catch {}
  console.log('='.repeat(60));
  console.log('seq', c.seq, 'tool', c.name);
  console.log('args', JSON.stringify(a).slice(0, 200));
  for (const r of resultsById.get(cid) || []) {
    console.log('--- result len', r.text.length, '---');
    const tail = r.text.slice(-260);
    console.log('HEAD:', r.text.slice(0, 120).replace(/\n/g, '|'));
    console.log('TAIL:', tail.replace(/\n/g, '|'));
  }
}
