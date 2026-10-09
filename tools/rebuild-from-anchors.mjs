// 从「所有会话的所有读取结果」里汇总带真实行号的文本，重建文件的最终状态。
//
// 原理：每次读取的每一行都自带它在**当时**文件里的绝对行号。文件被反复编辑时
// 行号会漂移，但「同一个行号的最后一次观测」就是该行在最终版本里的内容——
// 只要最后的读取覆盖过它。所以对每个行号保留时间戳最新的一份。
import fs from 'node:fs';

const want = process.argv[2] || 'styles.css';
const sessions = process.argv.slice(3);

// lineNo -> {time, seq, src, text}
const latest = new Map();
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
    if (o.type === 'tool/call') callById.set(d.callId, { seq: o.seq, name: d.name, args: d.arguments, time: o.time });
    else if (o.type === 'tool/result') {
      const cid = d.message?.toolCallId;
      if (!cid) continue;
      const t = (d.message?.content || []).map((x) => x.text || '').join('');
      if (!resultsById.has(cid)) resultsById.set(cid, []);
      resultsById.get(cid).push({ seq: o.seq, text: t, time: o.time });
    }
  }
  const src = sess.split(/[\\/]/).slice(-2)[0].slice(0, 12);

  for (const [cid, c] of callById) {
    if (c.name !== 'read') continue;
    let a;
    try {
      a = JSON.parse(c.args || '{}');
    } catch {
      continue;
    }
    if (!String(a.file_path || '').replace(/\\/g, '/').endsWith('/' + want)) continue;
    // 同一调用可能存有多份结果，取最长（未被裁剪的）
    const arr = (resultsById.get(cid) || []).slice().sort((x, y) => y.text.length - x.text.length);
    const r = arr[0];
    if (!r) continue;
    const time = r.time || c.time || 0;
    for (const m of r.text.matchAll(/^(\d+): ?(.*)$/gm)) {
      const n = +m[1];
      observations++;
      const prev = latest.get(n);
      if (!prev || time > prev.time || (time === prev.time && r.seq >= prev.seq)) {
        latest.set(n, { time, seq: r.seq, src, text: m[2] });
      }
    }
  }
}

const nums = [...latest.keys()].sort((a, b) => a - b);
const maxLine = Math.max(...nums);
console.log(`observations: ${observations}`);
console.log(`distinct line numbers observed: ${nums.length}`);
console.log(`max line number: ${maxLine}`);

const missing = [];
for (let n = 1; n <= maxLine; n++) if (!latest.has(n)) missing.push(n);
console.log(`missing line numbers in 1..${maxLine}: ${missing.length}`);
if (missing.length) {
  // 压缩成区间
  const ranges = [];
  let s = missing[0];
  let p = missing[0];
  for (const n of missing.slice(1)) {
    if (n === p + 1) {
      p = n;
    } else {
      ranges.push([s, p]);
      s = n;
      p = n;
    }
  }
  ranges.push([s, p]);
  console.log('  ranges:', ranges.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(', '));
}

// 时间跨度
const times = nums.map((n) => latest.get(n).time).filter(Boolean);
const fmt = (t) => new Date(t).toISOString().replace('T', ' ').slice(0, 19);
console.log(`anchor times: ${fmt(Math.min(...times))} -> ${fmt(Math.max(...times))}`);

// 输出重建文件
const out = [];
for (let n = 1; n <= maxLine; n++) out.push(latest.has(n) ? latest.get(n).text : `/*__MISSING_LINE_${n}__*/`);
const outPath = process.argv[2] === '--out' ? process.argv[3] : null;
if (outPath) {
  fs.writeFileSync(outPath, out.join('\n') + '\n', 'utf8');
  console.log('wrote', outPath);
}
fs.writeFileSync('C:/Users/18170/AppData/Local/Temp/anchors-union.css', out.join('\n') + '\n', 'utf8');
console.log('wrote C:/Users/18170/AppData/Local/Temp/anchors-union.css', out.length, 'lines');
