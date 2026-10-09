// 截图用：新建一个一次性供应商并保存，让回执在「粘住的标题行」里亮着，
// 然后把页面往下滚一段 —— 这样一张图同时说明三件事：回执在标题行里、
// 标题行粘在顶上、名册从它下面滚过去。
// 跑完必须用 tools/do-prov-receipt.js 或手工把这个 zz-shot-probe 删掉。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const byText = (sel, texts) =>
  [...document.querySelectorAll(sel)].find((el) => texts.includes(el.textContent.trim())) ?? null;
const setInput = (el, v) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

byText('.bay-head button', ['新建', 'NEW']).click();
await sleep(200);
setInput(document.querySelector('#f-name'), 'zz-shot-probe');
setInput(document.querySelector('#f-url'), 'http://127.0.0.1:9911/v1');
await sleep(120);
document.querySelector('.prov-form button[type="submit"]').click();
await sleep(800);
// 滚到名册中段：标题行必须还钉在顶上，回执还在它里面
const sc = document.documentElement;
sc.scrollTop = 260;
await sleep(200);
return {
  scrollY: +window.scrollY.toFixed(1),
  receipt: document.querySelector('.prov-receipt')?.textContent ?? null,
  headTop: +document.querySelector('.prov-head').getBoundingClientRect().top.toFixed(1),
  roster: [...document.querySelectorAll('.slot-name')].map((n) => n.textContent),
};
