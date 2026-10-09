// 合并多个会话里对同一文件的编辑，按墙钟时间排序后重放。
//
// 背景：同一个 web/src/styles.css 曾被两个会话同时编辑，单会话重放必然短
// 一截。这里把两个会话的 edit/write 汇成一个时间线，取「所有会话里带
// @font-face 的最早完整读取」当基线，然后一路重放到最后。
import fs from 'node:fs';

const want = process.argv[2] || 'styles.css';
const outPath = process.argv[3];
const sessions = process.argv.slice(4);

const isT = (a) =>
  String(a.file_path || '')
    .replace(/\\/g, '/')
    .endsWith('/' + want);

const ops = [];
let baseline = null;

for (const sess of sessions) {
  const raw = fs.readFileSync(sess, 'utf8').split('\n').filter(Boolean);
  const callById = new Map();
  const resultsById = new Map();
  for (const l of raw) {
    let o;
    try {
      o = JSON.parse(l);
    } catch {
      continue;
    }
    const d = o.data || {};
    if (o.type === 'tool/call') callById.set(d.callId, { seq: o.seq, name: d.name, args: d.arguments, time: o.time || 0 });
    else if (o.type === 'tool/result') {
      const cid = d.message?.toolCallId;
      if (!cid) continue;
      const t = (d.message?.content || []).map((x) => x.text || '').join('');
      if (!resultsById.has(cid)) resultsById.set(cid, []);
      resultsById.get(cid).push({ seq: o.seq, text: t, time: o.time || 0 });
    }
  }
  const src = sess.split(/[\\/]/).slice(-2)[0].replace('session-', '').slice(0, 8);

  for (const [cid, c] of callById) {
    let a;
    try {
      a = JSON.parse(c.args || '{}');
    } catch {
      continue;
    }
    if (!isT(a)) continue;

    // 结果（判断这次编辑是否成功）
    const arr = (resultsById.get(cid) || []).slice().sort((x, y) => y.text.length - x.text.length);
    const res = arr[0]?.text || '';

    if (c.name === 'edit' || c.name === 'write') {
      ops.push({ src, seq: c.seq, time: c.time, name: c.name, a, res });
    }

    // 基线候选：完整读取（带 @font-face 与 EOF 尾注）
    if (c.name === 'read') {
      for (const r of arr) {
        if (!r.text.includes('@font-face')) continue;
        if (!/\(End of file - total (\d+) lines\)/.test(r.text)) continue;
        if (!baseline || r.time < baseline.time || (r.time === baseline.time && r.text.length > baseline.len)) {
          baseline = { src, seq: c.seq, time: r.time || c.time, len: r.text.length, text: r.text };
        }
      }
    }
  }
}

if (!baseline) {
  console.error('no baseline');
  process.exit(2);
}
console.log(
  `baseline from ${baseline.src} seq ${baseline.seq} @ ${new Date(baseline.time).toISOString()} (${baseline.len} bytes)`
);

function strip(text) {
  const raw = text.split('\n');
  const first = raw.findIndex((l) => /^\s*\d+: /.test(l));
  if (first === -1) return '';
  const body = [];
  for (let i = first; i < raw.length; i++) {
    const m = raw[i].match(/^\s*\d+: ?(.*)$/);
    if (!m) break;
    body.push(m[1]);
  }
  return body.join('\n');
}

let content = strip(baseline.text);
if (!content.endsWith('\n')) content += '\n';
console.log('baseline:', content.split('\n').length - 1, 'lines');

// 只保留基线之后的编辑，按时间排序（同一时刻用 src+seq 兜底）
const later = ops
  .filter((o) => o.time > baseline.time || (o.time === baseline.time && o.seq > baseline.seq))
  .sort((x, y) => x.time - y.time || String(x.src).localeCompare(String(y.src)) || x.seq - y.seq);

console.log(`edits after baseline: ${later.length} (from ${new Set(later.map((o) => o.src)).size} sessions)`);

const OK = /has been updated successfully|has been created successfully|Created file|updated successfully/;
const ERR = /^\s*Error:|was not found|EIO|EBUSY|sandbox:/;

let applied = 0,
  failed = 0,
  nomatch = 0,
  idem = 0,
  writes = 0;
const problems = [];

for (const op of later) {
  const ok = OK.test(op.res) && !ERR.test(op.res);
  if (!ok) {
    failed++;
    continue;
  }
  if (op.name === 'write') {
    content = op.a.content;
    writes++;
    applied++;
    continue;
  }
  const oldS = op.a.old_string;
  const newS = op.a.new_string ?? '';
  if (typeof oldS !== 'string' || !oldS) {
    nomatch++;
    continue;
  }
  if (content.includes(oldS)) {
    content = op.a.replace_all ? content.split(oldS).join(newS) : content.replace(oldS, newS);
    applied++;
  } else if (newS && content.includes(newS.trim())) {
    idem++;
  } else {
    nomatch++;
    problems.push(`${op.src}/seq${op.seq}`);
  }
}

console.log(JSON.stringify({ applied, writes, failed, idem, nomatch }));
if (problems.length) console.log('   unmatched:', problems.join(', '));

fs.writeFileSync(outPath, content, 'utf8');
console.log(`wrote ${outPath}: ${content.length} bytes, ${content.split('\n').length - 1} lines`);
