// 用会话记录里所有「带行号的读取结果」当锚点，逐行校验重建出来的 CSS。
//
// 每份 read 结果都带真实行号（`1430: ...`），这是地面真值：如果重建的
// 第 1430 行和记录里第 1430 行不一致，就说明重放漏了或多了东西。
import fs from 'node:fs';

const sess = process.argv[2];
const rebuiltPath = process.argv[3];
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

// 收集所有锚点：{lineNo -> text}，同一行号若有多份，取 seq 最大的（最新真值）
const anchors = new Map();
let maxLineSeen = 0;
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
    for (const m of r.text.matchAll(/^(\d+): ?(.*)$/gm)) {
      const n = +m[1];
      if (n > maxLineSeen) maxLineSeen = n;
      const prev = anchors.get(n);
      if (!prev || c.seq >= prev.seq) anchors.set(n, { seq: c.seq, text: m[2] });
    }
  }
}
console.log('anchored lines:', anchors.size, 'max line number seen in any read:', maxLineSeen);
console.log('rebuilt lines:', rebuilt.length);

let ok = 0;
const bad = [];
for (const [n, a] of anchors) {
  const actual = rebuilt[n - 1];
  if (actual === a.text) ok++;
  else bad.push({ n, seq: a.seq, want: a.text, got: actual });
}
console.log(`anchor match: ${ok}/${anchors.size}`);
if (bad.length) {
  console.log('--- mismatches (first 40) ---');
  bad.sort((x, y) => x.n - y.n).slice(0, 40).forEach((b) => {
    console.log(`  line ${b.n} (from read seq ${b.seq})`);
    console.log(`     want: ${JSON.stringify(b.want)}`);
    console.log(`     got : ${JSON.stringify(b.got)}`);
  });
}

// 是否有超过重建长度的锚点 → 说明文件其实更长
const beyond = [...anchors.keys()].filter((n) => n > rebuilt.length);
console.log('anchors beyond rebuilt length:', beyond.length, beyond.length ? `(max ${Math.max(...beyond)})` : '');
