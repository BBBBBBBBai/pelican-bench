// 从 DSH 会话记录里重建 web/src/styles.css。
//
// 关键点三条：
// 1. 会话记录对同一次工具调用可能存有多份 tool/result（原始版 + 之后被裁掉的
//    版本），所以每份都留着，挑最长且带 @font-face / EOF 尾注的那份当基线。
// 2. **只重放当时真正成功的 edit**。会话记录里有失败调用（EBUSY、"old_string
//    was not found"），它们的 old_string 有时恰好能匹配上重建态，盲目应用会
//    伪造出一次不存在的修改。
// 3. 成功的 edit 若匹配不上，先看 new_string 是不是已经在文里（幂等），
//    再退回「空白归一化」匹配；仍不行就报为未解决，交给人处理。
import fs from 'node:fs';

const sess = process.argv[2];
const outPath = process.argv[3];
const TARGET = 'styles.css';

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
  if (o.type === 'tool/call') {
    callById.set(d.callId, { seq: o.seq, name: d.name, args: d.arguments });
  } else if (o.type === 'tool/result') {
    const cid = d.message?.toolCallId;
    if (!cid) continue;
    const text = (d.message?.content || []).map((x) => x.text || '').join('');
    if (!resultsById.has(cid)) resultsById.set(cid, []);
    resultsById.get(cid).push({ seq: o.seq, text });
  }
}

const isTarget = (a) =>
  String(a.file_path || '')
    .replace(/\\/g, '/')
    .endsWith('/' + TARGET);

const OK_MARK = /has been updated successfully|has been created successfully|Created file|updated successfully/;
const ERR_MARK = /^\s*Error:|was not found|EIO|EBUSY|sandbox:/;

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

// ---- 基线：最靠后的完整读取 ----
let base = null;
for (const [cid, c] of callById) {
  if (c.name !== 'read') continue;
  let a;
  try {
    a = JSON.parse(c.args || '{}');
  } catch {
    continue;
  }
  if (!isTarget(a)) continue;
  for (const r of resultsById.get(cid) || []) {
    if (!r.text.includes('@font-face')) continue;
    if (!/\(End of file - total (\d+) lines\)/.test(r.text)) continue;
    if (!base || r.text.length > base.text.length) base = { seq: c.seq, text: r.text };
  }
}
if (!base) {
  console.error('no full read snapshot');
  process.exit(2);
}
let content = strip(base.text);
if (!content.endsWith('\n')) content += '\n';
console.log(`baseline: call seq ${base.seq}, ${content.split('\n').length - 1} lines, ${content.length} chars`);

// ---- 收集 ops ----
const ops = [];
for (const [cid, c] of callById) {
  if (c.seq <= base.seq) continue;
  if (c.name !== 'edit') continue;
  let a;
  try {
    a = JSON.parse(c.args || '{}');
  } catch {
    continue;
  }
  if (!isTarget(a)) continue;
  const res = (resultsById.get(cid) || []).map((r) => r.text).join('\n');
  const succeeded = OK_MARK.test(res) && !ERR_MARK.test(res);
  ops.push({ seq: c.seq, a, succeeded, res: res.slice(0, 90) });
}
ops.sort((x, y) => x.seq - y.seq);
console.log(`edits after baseline: ${ops.length} (succeeded ${ops.filter((o) => o.succeeded).length})`);

const collapse = (s) => s.replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n');
let applied = 0,
  idem = 0,
  skipped = 0;
const unresolved = [];

for (const op of ops) {
  const oldS = op.a.old_string;
  const newS = op.a.new_string ?? '';
  if (!op.succeeded) {
    skipped++;
    continue;
  }
  if (content.includes(oldS)) {
    content = op.a.replace_all ? content.split(oldS).join(newS) : content.replace(oldS, newS);
    applied++;
    continue;
  }
  // 幂等：new_string 已在文中
  if (newS && content.includes(newS.trim())) {
    idem++;
    continue;
  }
  // 空白归一化匹配
  if (collapse(content).includes(collapse(oldS))) {
    content = collapse(content);
    content = content.replace(collapse(oldS), newS);
    applied++;
    continue;
  }
  unresolved.push(op.seq);
}

console.log(JSON.stringify({ applied, idem, skippedFailed: skipped, unresolved }));
if (unresolved.length) console.log('   UNRESOLVED seqs:', unresolved.join(', '));

fs.writeFileSync(outPath, content, 'utf8');
console.log(`wrote ${outPath}: ${content.length} chars, ${content.split('\n').length - 1} lines`);

// 会话记录里出现过的最大「of N lines」，用来校准重建结果
let maxReported = 0;
for (const r of resultsById.values())
  for (const x of r) {
    for (const m of x.text.matchAll(/of (\d+) lines\)/g)) maxReported = Math.max(maxReported, +m[1]);
  }
console.log('largest line count ever reported in transcript:', maxReported);

const must = ['@font-face', '--track-head', '.sheet-scrim', 'sheet-seat-calm', 'prefers-reduced-motion', '--t-sub', '.bay-head .silk', 'Seated Panel'];
console.log('--- self check ---');
for (const m of must) console.log(`  ${content.includes(m) ? 'OK  ' : 'MISS'} ${m}`);
