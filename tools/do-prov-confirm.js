// --do 文件：两段式删除的端到端验证。
//
// 全程只碰一个自己新建的临时供应商（ZZPROBE），不碰真档案。
// 走的是界面自己的流程（新建 → 选中 → 删两次），不直接调 API，
// 这样验到的就是用户真会走的那条路。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rosterNames = () =>
  [...document.querySelectorAll('.roster .slot-name')].map((n) => n.textContent.trim());
const pickSlot = (name) =>
  [...document.querySelectorAll('.roster .slot')].find(
    (s) => s.querySelector('.slot-name')?.textContent.trim() === name,
  );
const deleteBtn = () => document.querySelector('.prov-slot-out button.halt');
const editBtn = () => document.querySelector('.prov-slot-out button:not(.halt)');

// 「高亮」到底渲染成了什么——这是本轮唯一要断言的东西
const skin = (el) => {
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    label: el.textContent.trim(),
    armedClass: el.classList.contains('armed'),
    ariaPressed: el.getAttribute('aria-pressed'),
    background: cs.backgroundColor,
    borderColor: cs.borderTopColor,
    color: cs.color,
    boxShadow: cs.boxShadow,
    // nowrap + 固定两列：长出来的字必须装得下，装不下就是溢出
    scrollW: el.scrollWidth,
    clientW: el.clientWidth,
    overflowPx: el.scrollWidth - el.clientWidth,
  };
};

const result = { steps: [] };
const before = rosterNames();
result.rosterBefore = before;

// ── 1. 新建一个临时供应商 ───────────────────────────────────────────────
const set = (id, v) => {
  const el = document.getElementById(id);
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

const addBtn = [...document.querySelectorAll('.bay-head button')].find((b) => b.textContent.trim() === '新建');
addBtn?.click();
await sleep(450);
set('f-name', 'ZZPROBE');
set('f-url', 'http://127.0.0.1:9911');
await sleep(120);
document.querySelector('.prov-form button[type="submit"]')?.click();
await sleep(900);

result.created = rosterNames().includes('ZZPROBE');
result.rosterAfterCreate = rosterNames();

// 选中它
pickSlot('ZZPROBE')?.click();
await sleep(450);
result.selected = document.querySelector('.roster .slot[aria-pressed="true"] .slot-name')?.textContent.trim();

// ── 2. 第一段：按一次，只扣闩，不删 ─────────────────────────────────────
result.idle = skin(deleteBtn());
deleteBtn()?.click();
await sleep(320);
result.armed = skin(deleteBtn());
result.rosterAfterFirstClick = rosterNames();
result.survivedFirstClick = rosterNames().includes('ZZPROBE');

// ── 3. 走到别的工位 = 改主意，闩必须弹回来 ──────────────────────────────
const other = [...document.querySelectorAll('.roster .slot')].find(
  (s) => s.querySelector('.slot-name')?.textContent.trim() !== 'ZZPROBE',
);
if (other) {
  other.click();
  await sleep(320);
  result.armedAfterSwitch = skin(deleteBtn());
  // 回到临时档案，为第二段做准备
  pickSlot('ZZPROBE')?.click();
  await sleep(450);
  result.disarmedOnReturn = skin(deleteBtn());
}

// ── 4. 「编辑供应商」也必须把闩弹回来 ────────────────────────────────────
deleteBtn()?.click();
await sleep(260);
result.armedBeforeEdit = skin(deleteBtn())?.armedClass;
editBtn()?.click();
await sleep(500);
result.armedAfterEdit = document.querySelector('.prov-slot-out button.halt')
  ? skin(document.querySelector('.prov-slot-out button.halt'))?.armedClass
  : 'out-of-tree';
// 取消编辑，回到常态
document.querySelector('.prov-form button[type="button"]')?.click();
await sleep(500);

// ── 5. 第二段：真的删掉 ─────────────────────────────────────────────────
deleteBtn()?.click(); // 扣闩
await sleep(260);
result.armedAgain = skin(deleteBtn());
deleteBtn()?.click(); // 真删
await sleep(1100);
result.rosterAfterDelete = rosterNames();
result.deleted = !rosterNames().includes('ZZPROBE');
result.countRestored = rosterNames().length === before.length;

// 收尾：把选中挪回原来的第一家，别把界面留在半路
const first = document.querySelector('.roster .slot');
if (first) {
  first.click();
  await sleep(350);
}

document.querySelector('.prov-slot')?.scrollIntoView({ block: 'center' });
await sleep(200);
return result;
