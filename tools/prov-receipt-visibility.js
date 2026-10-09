// 量一件事：手机档下，用户**正在按「保存」的那一刻**，「供应商」标题行还在不在视野里。
// 上一轮把回执在手机档改成钉在屏幕底部，理由是「标题行在保存键上方 415px、视野只有 844px」——
// 那是控制台还在机架后面时的数。adapt 之后控制台整个提到机架之前，「供应商」是首屏第一节，
// 那条理由可能已经不成立了。这份探针就是去核对它，而不是照抄结论。
//
// 用法：node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --width=390 --height=844 --mobile --touch --do=tools/prov-receipt-visibility.js
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

const head = document.querySelector('.bay-section .bay-head');
const out = { viewport: { w: window.innerWidth, h: window.innerHeight }, steps: [] };

// ① 打开「新建」表单，不滚动，看标题行与保存键各自在哪
byText('.bay-head button', ['新建', 'NEW']).click();
await sleep(200);
const submit = document.querySelector('.prov-form button[type="submit"]');
out.open = {
  scrollY: +window.scrollY.toFixed(1),
  head: R(head),
  submit: R(submit),
  headOnScreen: head.getBoundingClientRect().top >= 0 && head.getBoundingClientRect().bottom <= window.innerHeight,
  submitOnScreen: submit.getBoundingClientRect().top >= 0 && submit.getBoundingClientRect().bottom <= window.innerHeight,
  // 保存键与标题行之间隔了多少 px —— 上一轮那个 415 就是这个数
  gap: +(submit.getBoundingClientRect().top - head.getBoundingClientRect().bottom).toFixed(1),
};

// ② 填好、保存，量回执落在哪、标题行还在不在
setInput(document.querySelector('#f-name'), 'zz-receipt-vis');
setInput(document.querySelector('#f-url'), 'http://127.0.0.1:9911/v1');
await sleep(100);
const beforeSave = { scrollY: +window.scrollY.toFixed(1), head: R(head), submit: R(submit) };
submit.click();
await sleep(700);
const rc = document.querySelector('.prov-receipt');
out.saved = {
  beforeSave,
  afterSaveScrollY: +window.scrollY.toFixed(1),
  scrolledBySave: +(window.scrollY - beforeSave.scrollY).toFixed(1),
  head: R(head),
  receipt: R(rc),
  receiptText: rc?.textContent ?? null,
  // 回执自己有没有落在标题行里（改成桌面样式之后这必须是 true）
  inHead: head.contains(rc),
  // 回执有没有在视野里
  receiptOnScreen: rc.getBoundingClientRect().top >= 0 && rc.getBoundingClientRect().bottom <= window.innerHeight,
  headOnScreen: head.getBoundingClientRect().top >= 0 && head.getBoundingClientRect().bottom <= window.innerHeight,
  docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
};

// ③ 收尾：删掉这个一次性供应商
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
