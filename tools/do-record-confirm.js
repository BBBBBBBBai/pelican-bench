// --do 文件：标本页「删除记录」两段式确认的端到端验证。
//
// 全程不碰任何真实记录：先临时建一个指向本地假供应商（127.0.0.1:9911）的
// 临时档案 ZZPROBE，用它跑一次生成，拿这条自己造出来的记录做实验，
// 验完把记录和临时档案都删干净。
//
// 走的是界面自己的流程（建档案 → 跑 → 点格子开面板 → 删两次），
// 不直接调 API 去造记录，这样验到的就是用户真会走的那条路。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const records = async () => (await (await fetch('/api/records')).json()).records;
const cellFor = (providerName) =>
  [...document.querySelectorAll('.ch')].find(
    (c) => c.querySelector('.ch-prov')?.textContent.trim() === providerName,
  );
const deleteBtn = () => document.querySelector('.sheet .btn.halt');
const warn = () => document.querySelector('.sheet .note[role="status"]');

// 「高亮」到底渲染成了什么 —— 这是本轮唯一要断言的东西
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
    scrollW: el.scrollWidth,
    clientW: el.clientWidth,
    overflowPx: el.scrollWidth - el.clientWidth,
  };
};

const set = (id, v) => {
  const el = document.getElementById(id);
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

const result = {};
result.countBefore = (await records()).length;

// ── 1. 造一个临时档案，指向本地假供应商 ─────────────────────────────────
const addBtn = [...document.querySelectorAll('.bay-head button')].find((b) => b.textContent.trim() === '新建');
addBtn?.click();
await sleep(450);
set('f-name', 'ZZPROBE');
set('f-url', 'http://127.0.0.1:9911');
set('f-key', 'probe-key');
await sleep(120);
document.querySelector('.prov-form button[type="submit"]')?.click();
await sleep(1200);
result.providerCreated = [...document.querySelectorAll('.roster .slot-name')].some(
  (n) => n.textContent.trim() === 'ZZPROBE',
);

// ── 1b. 模型名现在是「本次运行」的输入，不在档案表单里 ──────────────────
// 不填它，「开始生成」是禁用的 —— 顺便断言这道门真的立着。
result.armDisabledWithNoModel = document.querySelector('.btn.arm')?.disabled === true;
set('o-model', 'mock-good');
await sleep(200);
result.armEnabledAfterModel = document.querySelector('.btn.arm')?.disabled === false;

// ── 2. 跑一次，换来一条属于自己的一次性记录 ─────────────────────────────
document.querySelector('.btn.arm')?.click();
let mine = null;
for (let i = 0; i < 40 && !mine; i += 1) {
  await sleep(500);
  mine = (await records()).find((r) => r.providerName === 'ZZPROBE');
}
result.recordCreated = Boolean(mine);
result.recordId = mine?.id ?? null;
if (!mine) return result;

const cell = cellFor('ZZPROBE');
result.cellPresent = Boolean(cell);

// ── 3. 点开标本页 ───────────────────────────────────────────────────────
cell?.click();
await sleep(1400);
result.sheetOpen = Boolean(document.querySelector('.sheet'));
result.idle = skin(deleteBtn());

// ── 4. 第一段：按一次，只扣闩，绝不删 ───────────────────────────────────
deleteBtn()?.click();
await sleep(340);
result.armed = skin(deleteBtn());
result.warnShown = Boolean(warn());
result.warnText = warn()?.textContent.trim() ?? null;
result.sheetStillOpen = Boolean(document.querySelector('.sheet'));
result.countAfterFirstClick = (await records()).length;
result.survivedFirstClick = (await records()).some((r) => r.id === mine.id);

// ── 5. Esc = 改主意，先弹闩，不该关掉整张面板 ───────────────────────────
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
await sleep(260);
result.armedAfterEsc = skin(deleteBtn())?.armedClass;
result.sheetAfterEsc = Boolean(document.querySelector('.sheet'));

// ── 6. 第二段：真的删掉 ─────────────────────────────────────────────────
deleteBtn()?.click(); // 扣闩
await sleep(260);
result.armedAgain = skin(deleteBtn())?.armedClass;
deleteBtn()?.click(); // 真删
await sleep(300);
result.leavingDuringExit = Boolean(document.querySelector('.sheet-plate.leaving'));
await sleep(1400); // 等退场动画 + 兜底计时器走完
result.sheetGone = !document.querySelector('.sheet');
result.countAfterDelete = (await records()).length;
result.deleted = !(await records()).some((r) => r.id === mine.id);
result.countRestored = result.countAfterDelete === result.countBefore;

// ── 7. 收拾：把临时档案也删掉 ───────────────────────────────────────────
const slot = [...document.querySelectorAll('.roster .slot')].find(
  (s) => s.querySelector('.slot-name')?.textContent.trim() === 'ZZPROBE',
);
slot?.click();
await sleep(450);
const provDel = document.querySelector('.prov-slot-out button.halt');
provDel?.click();
await sleep(260);
provDel?.click();
await sleep(1200);
result.providerRemoved = ![...document.querySelectorAll('.roster .slot-name')].some(
  (n) => n.textContent.trim() === 'ZZPROBE',
);

return result;
