// 找出会话里所有「行数脚注」出现的位置，并打印其上下文（含 seq / 工具名 / 文件）。
import fs from 'node:fs';
import zlib from 'node:zlib';

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

const p = process.argv[2];
const text = decode(p);
const lines = text.split('\n').filter(Boolean);
const callById = new Map();
for (const l of lines) {
  let o;
  try {
    o = JSON.parse(l);
  } catch {
    continue;
  }
  if (o.type === 'tool/call') callById.set(o.data.callId, { seq: o.seq, name: o.data.name, args: o.data.arguments });
}

const want = process.argv[3] || 'styles.css';
for (const l of lines) {
  let o;
  try {
    o = JSON.parse(l);
  } catch {
    continue;
  }
  if (o.type !== 'tool/result') continue;
  const d = o.data || {};
  const cid = d.message?.toolCallId;
  const t = (d.message?.content || []).map((x) => x.text || '').join('');
  const m = t.match(/\(Showing lines (\d+)-(\d+) of (\d+)\./);
  if (!m) continue;
  const c = callById.get(cid);
  if (!c) continue;
  let a = {};
  try {
    a = JSON.parse(c.args || '{}');
  } catch {}
  if (!String(a.file_path || '').includes(want)) continue;
  console.log(`call seq ${c.seq} | showing ${m[1]}-${m[2]} of ${m[3]} | payload ${t.length}`);
}

// 同时列出所有报告过的 total
const totals = new Map();
for (const l of lines) {
  let o;
  try {
    o = JSON.parse(l);
  } catch {
    continue;
  }
  if (o.type !== 'tool/result') continue;
  const t = (o.data?.message?.content || []).map((x) => x.text || '').join('');
  const cid = o.data?.message?.toolCallId;
  const c = callById.get(cid);
  if (!c) continue;
  let a = {};
  try {
    a = JSON.parse(c.args || '{}');
  } catch {}
  if (!String(a.file_path || '').includes(want)) continue;
  for (const mm of t.matchAll(/of (\d+) lines\)/g)) {
    if (!totals.has(+mm[1])) totals.set(+mm[1], []);
    totals.get(+mm[1]).push(c.seq);
  }
}
console.log('--- totals ---');
[...totals.entries()].sort((x, y) => x[0] - y[0]).forEach(([n, seqs]) => console.log(`  ${n} lines at call seqs ${seqs.join(',')}`));
