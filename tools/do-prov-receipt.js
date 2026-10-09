// 验收：供应商保存 / 删除之后的回执。
//   桌面（>900px）：进「供应商」标题行、「新建」键左边，槽位宽度留死，刻线不动。
//   手机（<=900px）：同一颗元素改钉在屏幕底部（保留原来的位置）。
// 同一份探针跑两档：--width=1440 --height=900 与 --mobile --width=390 --height=844。
//
// 它会真的新建一个一次性供应商、再把它删掉 —— 原有档案一根汗毛都不动。
// 跑之前先备份 config.json，跑完比对还原（端到端探针的老规矩）。
//
// 用法：node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --width=1440 --height=900 --do=tools/do-prov-receipt.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 中英各来一份：同一份探针要在两种语言下都能跑（切语言会 PATCH config.json 的 uiLang，
// 跑英文那一轮之前先 do-lang-en.js、之后必须 do-lang-zh.js 收尾）。
const L = {
  add: ['新建', 'NEW'],
  edit: ['编辑供应商', 'EDIT PROVIDER'],
  cancel: ['取消', 'CANCEL'],
  del: ['删除', 'DELETE'],
  confirm: ['确认删除', 'CONFIRM DELETE'],
};
const byText = (sel, texts) =>
  [...document.querySelectorAll(sel)].find((el) => texts.includes(el.textContent.trim())) ?? null;
const rect = (el) => {
  const r = el.getBoundingClientRect();
  return { x: +r.x.toFixed(2), w: +r.width.toFixed(2), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) };
};
const color = (el) => (el ? getComputedStyle(el).color : null);
const setInput = (el, v) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

const head = document.querySelector('.bay-section .bay-head');
const rule0 = rect(head.querySelector('.rule'));
const moved = (r) => Math.abs(r.x - rule0.x) > 0.01 || Math.abs(r.w - rule0.w) > 0.01;
const receiptText = () => document.querySelector('.prov-receipt')?.textContent ?? null;
const noteEl = () => document.querySelector('.prov-receipt-note');

// 一颗回执「看得见吗、在哪儿、压在上面吗」——三档共用同一组问题。
const place = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return {
    position: cs.position,
    inHead: head.contains(el),
    visible: r.width > 0 && r.height > 0,
    bottomGap: +(window.innerHeight - r.bottom).toFixed(1),
    topmost: hit === el || el.contains(hit) ? 'self' : typeof hit?.className === 'string' ? hit.className : hit?.tagName ?? null,
    rect: rect(el),
  };
};
// 表单是「收起来」还是「升出来」—— `.prov-form` 永远在树里，只能看槽位的状态。
const slotState = () => {
  const s = document.querySelector('.prov-slot');
  return { open: s.classList.contains('open'), inH: +s.querySelector('.prov-slot-in').getBoundingClientRect().height.toFixed(1) };
};

const out = { viewport: { w: window.innerWidth, h: window.innerHeight }, mobile: window.innerWidth <= 900, ruleBefore: rule0, steps: [] };
const step = (name, extra) => out.steps.push({ name, ...extra });

// ── ① 新建一个一次性供应商，保存 ──────────────────────────────────────────
byText('.bay-head button', L.add).click();
await sleep(140);
setInput(document.querySelector('#f-name'), 'zz-receipt-probe');
setInput(document.querySelector('#f-url'), 'http://127.0.0.1:9911/v1');
await sleep(100);
document.querySelector('.prov-form button[type="submit"]').click();
await sleep(700);

const rc = document.querySelector('.prov-receipt');
step('save', {
  text: receiptText(),
  role: rc?.getAttribute('role') ?? null,
  color: color(rc),
  place: place(rc),
  rule: rect(head.querySelector('.rule')),
  ruleMoved: moved(rect(head.querySelector('.rule'))),
  toastInDom: Boolean(document.querySelector('.toast')),
  slot: slotState(),
  roster: [...document.querySelectorAll('.slot-name')].map((n) => n.textContent),
});

// ── ② 5s 之后自己走 ───────────────────────────────────────────────────────
await sleep(5100);
step('expire', { text: receiptText(), place: place(rc), ruleMoved: moved(rect(head.querySelector('.rule'))) });

// ── ③ 失败面：清空接口地址再保存（长句另起一行）───────────────────────────
byText('.prov-slot-out button', L.edit).click();
await sleep(200);
setInput(document.querySelector('#f-url'), '');
await sleep(100);
document.querySelector('.prov-form button[type="submit"]').click();
await sleep(400);

const note = noteEl();
step('fail', {
  noteText: note?.textContent ?? null,
  noteColor: color(note),
  noteRole: note?.getAttribute('role') ?? null,
  notePlace: place(note),
  noteBelowHead: note ? note.getBoundingClientRect().top >= head.getBoundingClientRect().bottom : null,
  ruleMoved: moved(rect(head.querySelector('.rule'))),
  receiptText: receiptText(),
  slot: slotState(),
});

// ── ④ 「取消」把回执一起收掉、表单收回去 ──────────────────────────────────
byText('.prov-form button', L.cancel).click();
await sleep(500);
step('cancel', {
  noteVisible: Boolean(noteEl() && noteEl().getBoundingClientRect().height > 0),
  receiptText: receiptText(),
  slot: slotState(),
});

// ── ⑤ 删除这个一次性供应商 ────────────────────────────────────────────────
byText('.prov-slot-out button', L.del).click();
await sleep(180);
const armedText = byText('.prov-slot-out button', L.confirm)?.textContent ?? null;
byText('.prov-slot-out button', L.confirm).click();
await sleep(700);

const rd = document.querySelector('.prov-receipt');
step('delete', {
  armedText,
  text: receiptText(),
  color: color(rd),
  place: place(rd),
  ruleMoved: moved(rect(head.querySelector('.rule'))),
  toastInDom: Boolean(document.querySelector('.toast')),
  roster: [...document.querySelectorAll('.slot-name')].map((n) => n.textContent),
});

out.headText = head.textContent;
out.finalRoster = [...document.querySelectorAll('.slot-name')].map((n) => n.textContent);
out.selected = [...document.querySelectorAll('.slot[aria-pressed="true"] .slot-name')].map((n) => n.textContent);
return out;
