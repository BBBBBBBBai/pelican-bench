// 用会话记录里的「行数脚注」当独立地面真值，校验恢复出来的 CSS 行数。
//
// read 的结果带 (End of file - total N lines)，edit/write 的结果带
// "The file ... has been updated ... showing lines X-Y of N"。
// 这些都是运行当时的真实读数，和恢复副本对比就能知道有没有缺内容。
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
const EVENT = /styles\.css/;

for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n').filter(Boolean);
  const byCall = new Map();
  for (const l of lines) {
    let o;
    try {
      o = JSON.parse(l);
    } catch {
      continue;
    }
    const d = o.data || {};
    if (o.type === 'tool/call') byCall.set(d.callId, { seq: o.seq, time: o.time, name: d.name, args: String(d.arguments || '') });
    else if (o.type === 'tool/result') {
      const cid = d.message?.toolCallId;
      const c = byCall.get(cid);
      if (!c || !EVENT.test(c.args)) continue;
      const text = (d.message?.content || []).map((x) => x.text || '').join('');
      for (const m of text.matchAll(/of (\d+) lines/g)) {
        console.log(`${f.split(/[\\/]/).pop()}  seq ${String(c.seq).padStart(5)}  ${new Date(c.time).toISOString()}  ${c.name.padEnd(6)}  of ${m[1]} lines`);
      }
    }
  }
}
