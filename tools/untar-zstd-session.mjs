// 把 DSH 会话记录（多帧拼接的 zstd）解出来。
// 每帧都以 28 b5 2f fd 开头，但压缩数据内部也可能偶然出现同样的四字节，
// 所以逐帧「从当前游标出发，逐个候选终点试解，第一个成功的即为该帧终点」。
import fs from 'node:fs';
import zlib from 'node:zlib';

const src = process.argv[2];
const dst = process.argv[3];
const buf = fs.readFileSync(src);

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const offsets = [];
for (let i = 0; i + 4 <= buf.length; i++) {
  if (buf.compare(MAGIC, 0, 4, i, i + 4) === 0) offsets.push(i);
}

const out = [];
let cursor = 0;
let frame = 0;
let tries = 0;

while (cursor < buf.length) {
  // 从 cursor 之后找下一个候选终点；cursor 本身不一定是帧头，
  // 所以先定位「>= cursor 的第一个 magic」。
  const startIdx = offsets.findIndex((o) => o >= cursor);
  if (startIdx === -1) break;
  const start = offsets[startIdx];
  if (start !== cursor) {
    // 帧与帧之间有填充字节，跳过
    cursor = start;
    continue;
  }
  let done = false;
  for (let j = startIdx + 1; j <= offsets.length; j++) {
    const end = j < offsets.length ? offsets[j] : buf.length;
    tries++;
    try {
      const dec = zlib.zstdDecompressSync(buf.subarray(start, end), { maxOutputLength: 64 * 1024 * 1024 });
      out.push(dec);
      cursor = end;
      frame++;
      done = true;
      break;
    } catch {
      /* 试下一个终点 */
    }
  }
  if (!done) {
    cursor = offsets[startIdx + 1] ?? buf.length;
  }
}

const text = Buffer.concat(out).toString('utf8');
fs.writeFileSync(dst, text, 'utf8');
console.log(JSON.stringify({ frames: frame, tries, bytes: text.length, lines: text.split('\n').filter(Boolean).length }));
