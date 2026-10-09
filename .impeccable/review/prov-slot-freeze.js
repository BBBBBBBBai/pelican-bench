/**
 * 把展开动画放慢 10 倍、改成线性，然后在半途停下来读一帧：
 * 看的是「中间的形态」——表单有没有被槽口切错、两块有没有撞在一起。
 * 只影响这一次截图。
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const s = document.createElement('style');
s.textContent = `
  .prov-slot-out, .prov-slot-in { transition-duration: 6s !important; transition-timing-function: linear !important; }
  .prov-form, .prov-slot-out > .row { transition-duration: 6s !important; transition-timing-function: linear !important; }
`;
document.head.appendChild(s);

const btn = [...document.querySelectorAll('.btn')].find((b) => /编辑|EDIT/i.test(b.textContent));
btn.click();
await sleep(1000); // + 工具自己的 900ms ≈ 全程的 1/3
return { mid: true };
