// 在若干个会话里找出「对某文件最完整的读取快照」以及「之后是否还有编辑」。
import fs from 'node:fs';

const want = process.argv[2] || 'styles.css';
const sessions = process.argv.slice(3);

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
    if (o.type === 'tool/call') callById.set(d.callId, { seq: o.seq, name: d.name, args: d.arguments });
    else if (o.type === 'tool/result') {
      const cid = d.message?.toolCallId;
      if (!cid) continue;
      const t = (d.message?.content || []).map((x) => x.text || '').join('');
      if (!resultsById.has(cid)) resultsById.set(cid, []);
      resultsById.get(cid).push({ seq: o.seq, text: t });
    }
  }
  const isT = (a) => String(a.file_path || '').replace(/\\/g, '/').endsWith('/' + want);

  // 所有读取，按「能看到的行号最大值」排序
  const reads = [];
  let lastEditSeq = 0;
  for (const [cid, c] of callById) {
    let a;
    try {
      a = JSON.parse(c.args || '{}');
    } catch {
      continue;
    }
    if (!isT(a)) continue;
    if (c.name === 'edit' || c.name === 'write') lastEditSeq = Math.max(lastEditSeq, c.seq);
    if (c.name !== 'read') continue;
    for (const r of resultsById.get(cid) || []) {
      const nums = [...r.text.matchAll(/^(\d+): /gm)].map((m) => +m[1]);
      if (!nums.length) continue;
      reads.push({ seq: c.seq, min: Math.min(...nums), max: Math.max(...nums), len: r.text.length, covered: nums.length });
    }
  }
  reads.sort((a, b) => b.max - a.max || b.len - a.len);
  console.log('='.repeat(70));
  console.log('session', sess.split(/[\\/]/).slice(-2)[0], '| last edit seq', lastEditSeq);
  console.log('  top reads by max line number:');
  reads.slice(0, 8).forEach((r) =>
    console.log(`    seq ${r.seq}: lines ${r.min}-${r.max} (${r.covered} lines shown), payload ${r.len}${r.seq > lastEditSeq ? '  [AFTER last edit]' : ''}`)
  );
}
