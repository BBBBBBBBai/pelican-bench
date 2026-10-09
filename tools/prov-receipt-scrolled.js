// 关键一问：手机的**横屏档**下，用户必须滚动才能够到「保存」键
// （844×390 里保存键在 y585，视口只有 390）。那一滚之后，「供应商」标题行还在不在？
// 回执要留在标题行里（桌面样式），标题行就得在按保存的那一刻还看得见。
//
// 所以这份探针不程序化直点保存键，而是**先把保存键滚进视野**，再量标题行。
// 用法：node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --width=844 --height=390 --mobile --touch --do=tools/prov-receipt-scrolled.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const byText = (sel, texts) =>
  [...document.querySelectorAll(sel)].find((el) => texts.includes(el.textContent.trim())) ?? null;
const setInput = (el, v) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const R = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1) };
};
// 从保存键往上找出真正会滚的那个祖先
const scroller = (el) => {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return document.scrollingElement;
};

const head = document.querySelector('.bay-section .bay-head');
const out = { viewport: { w: window.innerWidth, h: window.innerHeight }, steps: [] };

byText('.bay-head button', ['新建', 'NEW']).click();
await sleep(200);
setInput(document.querySelector('#f-name'), 'zz-receipt-scr');
setInput(document.querySelector('#f-url'), 'http://127.0.0.1:9911/v1');
await sleep(120);

const submit = document.querySelector('.prov-form button[type="submit"]');
const sc = scroller(submit);
out.scrollContainer = {
  tag: sc.tagName,
  cls: typeof sc.className === 'string' ? sc.className : '',
  clientH: sc.clientHeight,
  scrollH: sc.scrollHeight,
};
out.beforeScroll = { scTop: +sc.scrollTop.toFixed(1), head: R(head), submit: R(submit) };

// 把保存键滚进视野 —— 这就是真实用户按下去之前做的唯一一件事
submit.scrollIntoView({ block: 'center' });
await sleep(250);
out.afterScroll = {
  scTop: +sc.scrollTop.toFixed(1),
  head: R(head),
  submit: R(submit),
  headOnScreen: head.getBoundingClientRect().top >= 0 && head.getBoundingClientRect().bottom <= window.innerHeight,
  submitOnScreen: submit.getBoundingClientRect().top >= 0 && submit.getBoundingClientRect().bottom <= window.innerHeight,
};

// 就在这里按保存 —— 回执要说话，而标题行此刻在不在？
submit.click();
await sleep(700);
const rc = document.querySelector('.prov-receipt');
out.saved = {
  scTop: +sc.scrollTop.toFixed(1),
  head: R(head),
  headOnScreen: head.getBoundingClientRect().top >= 0 && head.getBoundingClientRect().bottom <= window.innerHeight,
  receipt: R(rc),
  receiptText: rc?.textContent ?? null,
  inHead: head.contains(rc),
  receiptOnScreen: rc ? rc.getBoundingClientRect().top >= 0 && rc.getBoundingClientRect().bottom <= window.innerHeight : false,
  docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
};

// 收尾
byText('.prov-slot-out button', ['编辑供应商', 'EDIT PROVIDER']).click();
await sleep(200);
byText('.prov-form button', ['取消', 'CANCEL']).click();
await sleep(300);
byText('.prov-slot-out button', ['删除', 'DELETE']).click();
await sleep(180);
byText('.prov-slot-out button', ['确认删除', 'CONFIRM DELETE']).click();
await sleep(700);
out.cleanup = { roster: [...document.querySelectorAll('.slot-name')].map((n) => n.textContent) };
return out;
