// 决定性证据：把恢复后的文件交给 Vite 转译，再和事故前缓存里的那份逐字节比。
//
// 如果恢复出来的 CSS 少了或多了任何内容，Vite 的转译产物大小/字节就不可能
// 完全一致 —— 转译是确定性的，同样的输入必然给同样的输出。
import { readFileSync } from 'node:fs';

const cache = readFileSync(process.argv[2]);
const res = await fetch('http://127.0.0.1:5174/src/styles.css');
const served = Buffer.from(await res.arrayBuffer());

console.log('cache bytes :', cache.length);
console.log('served bytes:', served.length);
const same = cache.equals(served);
console.log('byte-identical:', same);

if (!same) {
  // 找出第一处不同，好定位缺了什么
  const n = Math.min(cache.length, served.length);
  let i = 0;
  while (i < n && cache[i] === served[i]) i++;
  console.log('first diff at byte', i);
  console.log('cache :', JSON.stringify(cache.subarray(Math.max(0, i - 60), i + 60).toString('utf8')));
  console.log('served:', JSON.stringify(served.subarray(Math.max(0, i - 60), i + 60).toString('utf8')));
}
