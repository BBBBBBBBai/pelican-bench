// 诊断：把「真实文件行数」的轨迹抽出来，和重放结果对比，找出漏掉的编辑。
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

// 1) 所有带 old_string 的工具调用（不管工具名）
const byName = {};
const editish = [];
for (const [cid, c] of callById) {
  let a;
  try {
    a = JSON.parse(c.args || '{}');
  } catch {
    continue;
  }
  if (a.old_string === undefined && a.file_path === undefined) continue;
  byName[c.name] = (byName[c.name] || 0) + 1;
  if (a.old_string !== undefined) editish.push({ seq: c.seq, name: c.name, file: a.file_path });
}
console.log('tool calls with old_string/file_path by name:', JSON.stringify(byName));
console.log('calls carrying old_string:', editish.length);
const nonEdit = editish.filter((e) => e.name !== 'edit');
console.log('carrying old_string but NOT named edit:', nonEdit.length);
nonEdit.slice(0, 20).forEach((e) => console.log('   seq', e.seq, e.name, e.file));

// 2) 行数轨迹：每个 read 结果里报告的 total
const traj = [];
for (const [cid, c] of callById) {
  if (c.name !== 'read') continue;
  let a;
  try {
    a = JSON.parse(c.args || '{}');
  } catch {
    continue;
  }
  if (!String(a.file_path || '').includes('styles.css')) continue;
  for (const r of resultsById.get(cid) || []) {
    const m = r.text.match(/\(End of file - total (\d+) lines\)/);
    if (m) traj.push({ seq: c.seq, total: +m[1], len: r.text.length });
  }
}
traj.sort((a, b) => a.seq - b.seq);
console.log('--- reported total lines by read seq ---');
traj.forEach((t) => console.log(`  seq ${t.seq}: ${t.total} lines (payload ${t.len})`));
