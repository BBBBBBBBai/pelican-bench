// 并排显示「某次读取看到的行」与「重建结果同一行」，并标明该读取的 seq 之后
// 还有哪些编辑动过这片区域。
import fs from 'node:fs';

const sess = process.argv[2];
const rebuiltPath = process.argv[3];
const wantSeq = Number(process.argv[4]);
const from = Number(process.argv[5] || 1);
const to = Number(process.argv[6] || 60);

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

const rebuilt = fs.readFileSync(rebuiltPath, 'utf8').split('\n');

for (const [cid, c] of callById) {
  if (c.seq !== wantSeq) continue;
  let a;
  try {
    a = JSON.parse(c.args || '{}');
  } catch {}
  console.log(`read seq ${c.seq} args ${JSON.stringify(a)}`);
  for (const r of resultsById.get(cid) || []) {
    const seen = new Map();
    for (const m of r.text.matchAll(/^(\d+): ?(.*)$/gm)) seen.set(+m[1], m[2]);
    console.log(`payload len ${r.text.length}`);
    for (let n = from; n <= to; n++) {
      if (!seen.has(n) && !rebuilt[n - 1]) continue;
      const w = seen.get(n);
      const g = rebuilt[n - 1];
      const flag = w === g ? '   ' : ' ≠ ';
      console.log(`${flag}${String(n).padStart(4)} | seen: ${JSON.stringify(w)} | rebuilt: ${JSON.stringify(g)}`);
    }
  }
}
