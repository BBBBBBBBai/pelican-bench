// 对照截图用（只依赖两版构建都有的元素，绝不 querySelector('.prov-head')）：
// 新建一个一次性供应商并保存，让回执亮着，把页面滚到名册中段再截图。
// 旧构建（8787）上会看到回执是钉在屏幕底部的 toast；新构建（5174）上它长在标题行里且标题行粘住。
// 跑完必须删掉这个 zz-before-shot 供应商：node tools/edge-cdp.mjs probe <url> ... --do=tools/cleanup-before-shot.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const btnBy = (txt) =>
  [...document.querySelectorAll('.bay-head button')].find((b) => b.textContent.trim() === txt) ?? null;
const setInput = (el, v) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

const add = btnBy('新建') ?? btnBy('NEW');
if (!add) {
  return { error: 'no add button', lang: document.documentElement.lang, head: document.querySelector('.bay-head')?.textContent };
}
add.click();
await sleep(250);
setInput(document.querySelector('#f-name'), 'zz-before-shot');
setInput(document.querySelector('#f-url'), 'http://127.0.0.1:9911/v1');
await sleep(150);
document.querySelector('.prov-form button[type="submit"]').click();
await sleep(900);

// 滚到名册中段
document.documentElement.scrollTop = 260;
await sleep(250);

const rc = document.querySelector('.prov-receipt');
const note = document.querySelector('.prov-receipt-note');
const rr = rc?.getBoundingClientRect();
const nr = note?.getBoundingClientRect();
const hd = document.querySelector('.bay-head').getBoundingClientRect();
const fixedish = rc ? getComputedStyle(rc).position : null;
return {
  scrollY: +window.scrollY.toFixed(1),
  receipt: rc?.textContent ?? null,
  receiptPos: fixedish,
  receiptRect: rr ? { x: +rr.x.toFixed(1), y: +rr.y.toFixed(1), w: +rr.width.toFixed(1), h: +rr.height.toFixed(1) } : null,
  noteText: note ? note.textContent : null,
  noteRect: nr ? { x: +nr.x.toFixed(1), y: +nr.y.toFixed(1), w: +nr.width.toFixed(1), h: +nr.height.toFixed(1) } : null,
  headRect: { x: +hd.x.toFixed(1), y: +hd.y.toFixed(1), w: +hd.width.toFixed(1), h: +hd.height.toFixed(1) },
  viewport: { w: window.innerWidth, h: window.innerHeight },
  roster: [...document.querySelectorAll('.slot-name')].map((n) => n.textContent),
};
