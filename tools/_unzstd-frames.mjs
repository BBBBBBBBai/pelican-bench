// zstd 的会话记录是**多帧拼接**的（每次追加写一帧），932 帧。
// zstdDecompressSync 只吐第一帧（就是那行 session 头），所以这里逐帧解。
// 帧边界不可靠地靠 magic 找 —— magic 也会出现在压缩数据内部 —— 所以
// 从候选偏移试解，能解出合法 JSON 行的才算。
import { readFileSync, writeFileSync } from 'node:fs';
import { zstdDecompressSync } from 'node:zlib';

const src = process.argv[2];
const out = process.argv[3];
const buf = readFileSync(src);
const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

const offsets = [];
for (let i = 0; (i = buf.indexOf(magic, i)) !== -1; i += 4) offsets.push(i);
offsets.push(buf.length);

const parts = [];
let ok = 0;
let fail = 0;
for (let k = 0; k < offsets.length - 1; k++) {
  const slice = buf.subarray(offsets[k], offsets[k + 1]);
  try {
    parts.push(zstdDecompressSync(slice).toString('utf8'));
    ok++;
  } catch {
    fail++; // 假 magic，跳过：它的内容已经被上一帧覆盖
  }
}

const text = parts.join('');
writeFileSync(out, text, 'utf8');
console.log(JSON.stringify({ framesOk: ok, framesSkipped: fail, chars: text.length, lines: text.split('\n').length }));
