// 扫描全部会话，找某文件的「可读快照」：每次读取覆盖了哪些行、文件当时多长、
// 发生在什么时刻、该会话随后是否还改过这个文件。
import fs from 'node:fs';

const want = process.argv[2] || 'styles.css';
const sessions = process.argv.slice(3);
const fmt = (t) => (t && Number.isFinite(t) ? new Date(t).toISOString().replace('T', ' ').slice(0, 19) : '-');

const rows = [];
for (const sess of sessions) {
  const raw = fs.readFileSync(sess, 'utf8').split('\n').filter(Boolean);
  const callById = new Map();
  const resultsById = new Map();
  let tMin = Infinity;
  let tMax = -Infinity;
  for (const l of raw) {
    let o;
    try {
      o = JSON.parse(l);
    } catch {
      continue;
    }
    const d = o.data || {};
    if (o.time) {
      tMin = Math.min(tMin, o.time);
      tMax = Math.max(tMax, o.time);
    }
    if (o.type === 'tool/call') callById.set(d.callId, { seq: o.seq, name: d.name, args: d.arguments, time: o.time });
    else if (o.type === 'tool/result') {
      const cid = d.message?.toolCallId;
      if (!cid) continue;
      const t = (d.message?.content || []).map((x) => x.text || '').join('');
      if (!resultsById.has(cid)) resultsById.set(cid, []);
      resultsById.get(cid).push({ seq: o.seq, text: t, time: o.time });
    }
  }

  const isT = (a) => String(a.file_path || '').replace(/\\/g, '/').endsWith('/' + want);
  let editCount = 0;
  let lastEditTime = 0;
  const reads = [];

  for (const [cid, c] of callById) {
    let a;
    try {
      a = JSON.parse(c.args || '{}');
    } catch {
      continue;
    }
    if (!isT(a)) continue;
    if (c.name === 'edit' || c.name === 'write') {
      editCount++;
      lastEditTime = Math.max(lastEditTime, c.time || 0);
    }
    if (c.name !== 'read') continue;
    for (const r of resultsById.get(cid) || []) {
      const nums = [...r.text.matchAll(/^(\d+): /gm)].map((m) => +m[1]);
      if (!nums.length) continue;
      const mt = r.text.match(/of (\d+) lines\)/);
      reads.push({
        seq: c.seq,
        min: Math.min(...nums),
        max: Math.max(...nums),
        covered: nums.length,
        total: mt ? +mt[1] : null,
        time: r.time,
        bytes: r.text.length,
        hasFF: r.text.includes('@font-face'),
      });
    }
  }
  if (!reads.length && !editCount) continue;

  // 该会话里「覆盖行数最多、且含 @font-face」的读取
  const best = reads.filter((r) => r.hasFF).sort((a, b) => b.covered - a.covered)[0] || null;
  rows.push({
    name: sess.split(/[\\/]/).slice(-2)[0].replace('session-', '').slice(0, 14),
    span: `${fmt(tMin)} -> ${fmt(tMax)}`,
    editCount,
    lastEditTime,
    readCount: reads.length,
    best,
    maxTotal: Math.max(...reads.map((r) => r.total || 0)),
  });
}

rows.sort((a, b) => (b.best?.covered || 0) - (a.best?.covered || 0));
console.log(`file: ${want}\n`);
for (const r of rows) {
  const b = r.best;
  console.log(`${r.name} | ${r.span} | edits=${r.editCount} reads=${r.readCount} maxTotal=${r.maxTotal}`);
  if (b)
    console.log(
      `     BEST: seq ${b.seq} covers ${b.covered} lines (${b.min}..${b.max}) total=${b.total} bytes=${b.bytes} at ${fmt(b.time)}${b.time && b.time < r.lastEditTime ? '  [BEFORE last edit]' : '  [after last edit]'}`
    );
  else console.log('     BEST: none (no read containing @font-face)');
}
