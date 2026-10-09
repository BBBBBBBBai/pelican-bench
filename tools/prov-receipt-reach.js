// 手机档下要按「保存」，得先滚到保存键那儿。那一滚之后，「供应商」标题行还在不在？
// 回执要留在标题行里（跟桌面端同款），标题行就得在按下去的那一刻还看得见。
// 这份探针不程序化直点保存键，而是**只滚到刚够看见保存键**，再量标题行 ——
// 这最接近真人做的事：往下拨一点，按，然后看反馈。
//
// 用法：node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --width=844 --height=390 --mobile --touch --do=tools/prov-receipt-reach.js
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
const scrollerOf = (el) => {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return document.documentElement;
};

const head = document.querySelector('.bay-section .bay-head');
const out = { viewport: { w: window.innerWidth, h: window.innerHeight }, steps: [] };

byText('.bay-head button', ['新建', 'NEW']).click();
await sleep(200);
setInput(document.querySelector('#f-name'), 'zz-receipt-reach');
setInput(document.querySelector('#f-url'), 'http://127.0.0.1:9911/v1');
await sleep(120);

const submit = document.querySelector('.prov-form button[type="submit"]');
const sc = scrollerOf(submit);
const isDoc = sc === document.documentElement;
const scRect = isDoc ? { top: 0, bottom: window.innerHeight } : sc.getBoundingClientRect();
const sRect = submit.getBoundingClientRect();
// 只滚到「保存键的下沿刚进视野」为止，不多滚一 px
const need = Math.max(0, sRect.bottom - scRect.bottom);
if (isDoc) window.scrollTo(0, window.scrollY + need);
else sc.scrollTop += need;
await sleep(250);

const scRect2 = isDoc ? { top: 0, bottom: window.innerHeight } : sc.getBoundingClientRect();
out.reach = {
  scroller: `${sc.tagName}${typeof sc.className === 'string' && sc.className ? '.' + sc.className : ''}`,
  scrollNeeded: +need.toFixed(1),
  scTop: isDoc ? +window.scrollY.toFixed(1) : +sc.scrollTop.toFixed(1),
  scRect: { top: +scRect2.top.toFixed(1), bottom: +scRect2.bottom.toFixed(1) },
  head: R(head),
  headOnScreen: head.getBoundingClientRect().top >= 0 && head.getBoundingClientRect().bottom <= window.innerHeight,
  submit: R(submit),
  submitOnScreen: submit.getBoundingClientRect().top >= 0 && submit.getBoundingClientRect().bottom <= window.innerHeight,
  receiptSlot: R(document.querySelector('.prov-receipt')),
};

submit.click();
await sleep(700);
const rc = document.querySelector('.prov-receipt');
const ps = document.querySelector('.panel-scroll');
const isDoc2 = sc === document.documentElement;
const scRect3 = isDoc2 ? { top: 0, bottom: window.innerHeight } : sc.getBoundingClientRect();
out.saved = {
  // 保存后表单收回去，内容变矮 —— 浏览器会不会把标题行带回视野里？这是这一档的关键。
  scTop: isDoc2 ? +window.scrollY.toFixed(1) : +sc.scrollTop.toFixed(1),
  scClientH: sc.clientHeight,
  scContentH: sc.scrollHeight,
  panelScroll: { client: ps.clientHeight, content: ps.scrollHeight },
  head: R(head),
  headOnScreen: head.getBoundingClientRect().top >= 0 && head.getBoundingClientRect().bottom <= window.innerHeight,
  headInScroller: head.getBoundingClientRect().top >= scRect3.top && head.getBoundingClientRect().bottom <= scRect3.bottom,
  receipt: R(rc),
  receiptText: rc?.textContent ?? null,
  receiptOnScreen: rc ? rc.getBoundingClientRect().top >= 0 && rc.getBoundingClientRect().bottom <= window.innerHeight : false,
  receiptPos: rc ? getComputedStyle(rc).position : null,
  inHead: head.contains(rc),
  docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
};

// 收尾：删掉这个一次性供应商
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
