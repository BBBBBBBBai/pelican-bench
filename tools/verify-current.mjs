// 校验当前 web/src/styles.css 是否就是「所有会话里最后观测到的那个版本」。
//
// 每次读取结果里每一行都带绝对行号，这是地面真值。把全部会话的读取汇总，
// 每个行号保留时间戳最新的一份，再逐行比对当前文件——对得上的行数就是
// 重建置信度。
import fs from 'node:fs';

const target = process.argv[2];
const sessions = process.argv.slice(3);

// 只认这一次目标文件的**精确**路径，避免把 tools/_css-backup/styles.css 之类
// 同名的备份也当成锚点。
const normalizedTarget = target.replace(/\\/g, '/');
const wantAbs = normalizedTarget.startsWith('/') || /^[A-Za-z]:/.test(normalizedTarget)
  ? normalizedTarget.toLowerCase()
  : ('e:/学习资料/dsh/鹈鹕测试工具/' + normalizedTarget.replace(/^\.\//, '')).toLowerCase();

const anchors = new Map(); // lineNo -> {time, seq, text, src}
let observations = 0;

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
    if (c.name !== 'read') continue;
    let a;
    try {
      a = JSON.parse(c.args || '{}');
    } catch {
      continue;
    }
    if (!String(a.file_path || '').replace(/\\/g, '/').toLowerCase().endsWith('/web/src/styles.css')) continue;
    const arr = (resultsById.get(cid) || []).slice().sort((x, y) => y.text.length - x.text.length);
    const r = arr[0];
    if (!r) continue;
    const time = r.time || c.time || 0;
    for (const m of r.text.matchAll(/^(\d+): ?(.*)$/gm)) {
      const n = +m[1];
      observations++;
      const prev = anchors.get(n);
      if (!prev || time > prev.time) anchors.set(n, { time, seq: r.seq, text: m[2], src });
    }
  }
}

const current = fs.readFileSync(target, 'utf8').split('\n');
// 末尾换行会多切出一个空串
if (current[current.length - 1] === '') current.pop();

console.log(`current file: ${current.length} lines, ${fs.statSync(target).size} bytes`);
console.log(`anchors: ${anchors.size} distinct line numbers from ${observations} observations`);

let match = 0;
const bad = [];
for (const [n, a] of anchors) {
  const got = current[n - 1];
  if (got === a.text) match++;
  else bad.push({ n, ...a, got });
}
console.log(`anchor match: ${match}/${anchors.size}  (${((match / anchors.size) * 100).toFixed(2)}%)`);

// 只看「最新 20% 时间窗」的锚点——那才是文件末态
const times = [...anchors.values()].map((a) => a.time).sort((x, y) => x - y);
const cutoff = times[Math.floor(times.length * 0.8)];
const recent = [...anchors.entries()].filter(([, a]) => a.time >= cutoff);
const recentMatch = recent.filter(([n, a]) => current[n - 1] === a.text).length;
console.log(`recent-window anchors (>= ${new Date(cutoff).toISOString()}): ${recentMatch}/${recent.length}`);

if (bad.length) {
  console.log(`--- mismatches (${bad.length}), showing up to 25 ---`);
  for (const b of bad.sort((x, y) => x.n - y.n).slice(0, 25)) {
    console.log(`  line ${b.n} [${b.src}/seq${b.seq} @ ${new Date(b.time).toISOString().slice(11, 19)}]`);
    console.log(`     anchored: ${JSON.stringify(b.text)}`);
    console.log(`     current : ${JSON.stringify(b.got)}`);
  }
}

// 结构性健全性
const text = current.join('\n');
console.log('--- sanity ---');
console.log('  braces {}:', (text.match(/\{/g) || []).length, 'open /', (text.match(/\}/g) || []).length, 'close');
console.log('  @font-face blocks:', (text.match(/@font-face/g) || []).length);
console.log('  @keyframes:', (text.match(/@keyframes/g) || []).length);
console.log('  @media blocks:', (text.match(/@media/g) || []).length);
console.log('  MISSING markers:', (text.match(/__MISSING_LINE/g) || []).length);
console.log('  last line:', JSON.stringify(current[current.length - 1]));
