// 窄屏上「就地回执」的新前提：标题行是粘的。
// 这个探针只看三件事：
//   ① 粘住之后那一块是不是整幅宽、实底（左右没有缝、下面没有透明条），
//   ② 滚到「保存」键那一刻，回执是不是真的落在标题行里、并且在视野内，
//   ③ 名字长到折行时，标题行会不会把「新建」键挤出屏幕。
// 不点任何会改配置的键 —— 只打开表单看一眼。
//
// 用法：node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --mobile --width=390 --height=844 --touch --do=tools/prov-receipt-sticky-check.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const byText = (sel, texts) =>
  [...document.querySelectorAll(sel)].find((el) => texts.includes(el.textContent.trim())) ?? null;
const R = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: +r.x.toFixed(1), w: +r.width.toFixed(1), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1) };
};

const head = document.querySelector('.prov-head');
const bay = document.querySelector('.bay-section');
const out = { viewport: { w: window.innerWidth, h: window.innerHeight }, doc: document.documentElement.scrollHeight };

byText('.bay-head button', ['新建', 'NEW']).click();
await sleep(220);

out.formOpen = { head: R(head), bar: R(document.querySelector('.bay-head')), bay: R(bay) };

// 滚到「保存」键的下沿刚进视野 —— 这就是按下去的那一刻
const submit = document.querySelector('.prov-form button[type="submit"]');
const need = Math.max(0, submit.getBoundingClientRect().bottom - window.innerHeight);
window.scrollTo(0, need);
await sleep(160);

out.atSave = {
  scrollY: +window.scrollY.toFixed(1),
  head: R(head),
  bar: R(document.querySelector('.bay-head')),
  submit: R(submit),
  stuck: getComputedStyle(head).position === 'sticky',
  // 标题行的实底是不是横着盖满整幅宽（左右留缝就说明负外边距没吃对）
  headLeftFlush: Math.abs(head.getBoundingClientRect().left) < 0.6,
  headRightFlush: Math.abs(window.innerWidth - head.getBoundingClientRect().right) < 0.6,
  // 名字符最右边那颗键还在不在屏内
  addBtn: R(byText('.bay-head button', ['新建', 'NEW'])),
  bg: getComputedStyle(head).backgroundColor,
  // 粘住的那一条下面有没有露出别的东西：标题行下沿外 2px 处是什么
  below: (() => {
    const hb = head.getBoundingClientRect();
    const el = document.elementFromPoint(window.innerWidth / 2, hb.bottom + 2);
    return el ? `${el.tagName}.${typeof el.className === 'string' ? el.className : ''}` : null;
  })(),
  // 标题行正中间那一点，命中的是不是标题行自己（实底挡得住滚过来的内容）
  selfAtCenter: (() => {
    const hb = head.getBoundingClientRect();
    const el = document.elementFromPoint(window.innerWidth / 2, hb.top + hb.height / 2);
    return head.contains(el) ? 'self' : `${el?.tagName}.${typeof el?.className === 'string' ? el.className : ''}`;
  })(),
};

// 失败面：清空地址再提交，长句子必须跟着标题行一起停在视野里
const url = document.querySelector('#f-url');
const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
setter.call(url, '');
url.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(80);
submit.click();
await sleep(320);

const note = document.querySelector('.prov-receipt-note');
out.atFail = {
  scrollY: +window.scrollY.toFixed(1),
  noteText: note?.textContent ?? null,
  note: R(note),
  head: R(head),
  // 长句子必须在粘块**内部**，否则它留在上方原位等于没说
  noteInsideHead: head.contains(note),
  noteOnScreen: note ? note.getBoundingClientRect().top >= 0 && note.getBoundingClientRect().bottom <= window.innerHeight : null,
  submit: R(submit),
  bar: R(document.querySelector('.bay-head')),
};

byText('.prov-form button', ['取消', 'CANCEL']).click();
await sleep(400);
out.afterCancel = { head: R(head), noteVisible: Boolean(document.querySelector('.prov-receipt-note')?.getBoundingClientRect().height) };
return out;
