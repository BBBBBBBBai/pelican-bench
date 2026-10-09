// 摘要一个会话：起止时间、用户消息、以及是否读/写过目标文件。
import fs from 'node:fs';

const sess = process.argv[2];
const raw = fs.readFileSync(sess, 'utf8').split('\n').filter(Boolean);

const users = [];
let first = null;
let last = null;
const toolCount = {};
const filesTouched = new Set();

for (const l of raw) {
  let o;
  try {
    o = JSON.parse(l);
  } catch {
    continue;
  }
  const t = o.time;
  if (t) {
    if (first === null) first = t;
    last = t;
  }
  const d = o.data || {};
  if (o.type === 'user/message') {
    const txt = (d.message?.content || []).map((x) => x.text || '').join('');
    if (txt.trim()) users.push(txt.slice(0, 300));
  }
  if (o.type === 'tool/call') {
    toolCount[d.name] = (toolCount[d.name] || 0) + 1;
    try {
      const a = JSON.parse(d.arguments || '{}');
      if (a.file_path) filesTouched.add(String(a.file_path));
    } catch {}
  }
}

const fmt = (t) => (t ? new Date(t).toISOString().replace('T', ' ').slice(0, 19) : '?');
console.log('session:', sess.split(/[\\/]/).slice(-2)[0]);
console.log('  span:', fmt(first), '->', fmt(last));
console.log('  messages:', raw.length);
console.log('  tools:', JSON.stringify(toolCount));
console.log('  files touched:', filesTouched.size);
[...filesTouched].sort().forEach((f) => console.log('     ', f));
console.log('  user messages:', users.length);
users.slice(0, 12).forEach((u, i) => console.log(`   [${i}] ${u.replace(/\n/g, ' | ').slice(0, 200)}`));
