// 诊断：列出所有 old_string 匹配不上的 edit，并显示其内容与是否有「重试」。
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

const target = process.argv[3] || 'styles.css';
const want = process.argv[4]; // optional seq filter

for (const [cid, c] of callById) {
  if (c.name !== 'edit') continue;
  let a;
  try {
    a = JSON.parse(c.args || '{}');
  } catch {
    continue;
  }
  if (!String(a.file_path || '').replace(/\\/g, '/').endsWith('/' + target)) continue;
  if (want && String(c.seq) !== String(want)) continue;
  const res = (resultsById.get(cid) || []).map((r) => r.text).join('\n');
  const failed = /Error|EIO|Win32|no match|not found|failed/i.test(res);
  console.log('='.repeat(70));
  console.log('seq', c.seq, 'resLen', res.length, 'FAILED_RESPONSE', failed);
  console.log('--- old_string ---');
  console.log(a.old_string);
  console.log('--- new_string ---');
  console.log(a.new_string);
  console.log('--- result (first 200) ---');
  console.log(res.slice(0, 200));
}
