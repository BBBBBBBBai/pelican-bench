// 通用会话分析：报告某个 DSH 会话里对指定文件的所有 edit/write，以及报告过的文件行数。
import fs from 'node:fs';
import zlib from 'node:zlib';

const sess = process.argv[2];
const target = process.argv[3] || 'styles.css';

// 多帧 zstd：逐帧试解，第一个能解开的终点即为该帧终点
function decode(p) {
  const buf = fs.readFileSync(p);
  const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
  const offs = [];
  for (let i = 0; i + 4 <= buf.length; i++) if (buf.compare(MAGIC, 0, 4, i, i + 4) === 0) offs.push(i);
  const out = [];
  let cursor = 0;
  while (cursor < buf.length) {
    const si = offs.findIndex((o) => o >= cursor);
    if (si === -1) break;
    if (offs[si] !== cursor) {
      cursor = offs[si];
      continue;
    }
    let done = false;
    for (let j = si + 1; j <= offs.length; j++) {
      const end = j < offs.length ? offs[j] : buf.length;
      try {
        out.push(zlib.zstdDecompressSync(buf.subarray(offs[si], end), { maxOutputLength: 128 * 1024 * 1024 }));
        cursor = end;
        done = true;
        break;
      } catch {}
    }
    if (!done) cursor = offs[si + 1] ?? buf.length;
  }
  return Buffer.concat(out).toString('utf8');
}

const text = decode(sess);
const lines = text.split('\n').filter(Boolean);
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
    const t = (d.message?.content || []).map((x) => x.text || '').join('');
    if (!resultsById.has(cid)) resultsById.set(cid, []);
    resultsById.get(cid).push({ seq: o.seq, text: t });
  }
}

const isT = (a) => String(a.file_path || '').replace(/\\/g, '/').endsWith('/' + target);
let nEdit = 0,
  nWrite = 0;
const seqs = [];
for (const [cid, c] of callById) {
  if (c.name !== 'edit' && c.name !== 'write') continue;
  let a;
  try {
    a = JSON.parse(c.args || '{}');
  } catch {
    continue;
  }
  if (!isT(a)) continue;
  if (c.name === 'edit') nEdit++;
  else nWrite++;
  seqs.push(c.seq);
}
seqs.sort((a, b) => a - b);
console.log(`session ${sess.split(/[\\/]/).slice(-2)[0]}`);
console.log(`  total messages: ${lines.length}`);
console.log(`  ${target}: edits=${nEdit} writes=${nWrite}`);
console.log(`  seq range: ${seqs[0]} .. ${seqs[seqs.length - 1]}`);

// 报告过的文件行数
const totals = new Set();
for (const arr of resultsById.values())
  for (const r of arr) for (const m of r.text.matchAll(/of (\d+) lines\)/g)) totals.add(+m[1]);
console.log(`  reported line totals: ${[...totals].sort((a, b) => a - b).join(', ') || '(none)'}`);
