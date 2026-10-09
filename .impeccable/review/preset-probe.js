// --do 文件：在真实页面上走一遍「模型候选清单」那块编辑面，然后把 config.json 还原。
// 它只碰 modelPresets 这一个字段，最后一定写回原样 —— 否则巡检会污染真配置。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cfg = () => fetch('/api/config').then((r) => r.json());
const before = (await cfg()).modelPresets;

const setNative = (input, v) => {
  const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  d.set.call(input, v);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

// 真实用户是「先点进这一格再打字再回车」—— 不先 focus，组件里那句
// e.currentTarget.blur() 就是个空操作（本来就没焦点），什么都不会提交。
const typeAndEnter = async (input, v) => {
  input.focus();
  await sleep(40);
  setNative(input, v);
  await sleep(40);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
};

const rows = () => [...document.querySelectorAll('.preset-row')];
const last = () => rows()[rows().length - 1];
const lastInput = () => last().querySelector('input.preset-name');

const head = document.querySelector('.preset-head');
head?.scrollIntoView({ block: 'center' });
await sleep(300);

// ── 几何 ────────────────────────────────────────────────────────────────
const box = (el) => {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
};
const list = document.querySelector('.preset-list');
const geo = {
  list: box(list),
  listBorder: getComputedStyle(list).borderTopColor,
  listBg: getComputedStyle(list).backgroundColor,
  rowH: rows().map((r) => Math.round(r.getBoundingClientRect().height)),
  nameW: [...document.querySelectorAll('.preset-name')].map((i) => Math.round(i.getBoundingClientRect().width)),
  nameBorder: getComputedStyle(document.querySelector('.preset-name')).borderTopWidth,
  nameFont: getComputedStyle(document.querySelector('.preset-name')).fontFamily.split(',')[0],
  nameSize: getComputedStyle(document.querySelector('.preset-name')).fontSize,
  drop: [...document.querySelectorAll('.preset-drop')].map((d) => ({
    tag: d.tagName.toLowerCase(),
    w: Math.round(d.getBoundingClientRect().width),
  })),
  // 竖缝：名字右沿与叉的左沿应当只差 1px（那 1px 就是刻缝）
  seam: (() => {
    const r = rows()[0];
    const i = r.querySelector('.preset-name').getBoundingClientRect();
    const d = r.querySelector('.preset-drop').getBoundingClientRect();
    return Math.round(d.left - i.right);
  })(),
  restoreDisabled: document.querySelector('.preset-head button')?.disabled,
  restoreText: document.querySelector('.preset-head button')?.textContent.trim(),
  // 表尾那一格是不是最后一行的输入框
  tailIsLast: lastInput() === document.querySelector('.preset-list > .preset-row:last-child .preset-name'),
  tailPlaceholder: lastInput()?.placeholder,
  /* 空态什么时候出现 —— 稍后清空时才用得上，先记着这一段文字在不在 */
  emptyNoteShown: [...document.querySelectorAll('.preset-head ~ .note')].map((n) => n.textContent.trim()),
  scrollY: Math.round(scrollY),
};

// ── ① 回车加一条 ────────────────────────────────────────────────────────
const NAME = '__PROBE_MODEL__';
await typeAndEnter(lastInput(), NAME);
await sleep(700);
const afterAdd = (await cfg()).modelPresets;
const addState = {
  len: afterAdd.length,
  appended: afterAdd[afterAdd.length - 1] === NAME,
  // 回车之后光标应当走到新的一格上接着打
  focusIsTail: document.activeElement === lastInput(),
  tailValueAfter: lastInput()?.value,
  scrollY: Math.round(scrollY),
};

// ── ② 重名不写盘 ────────────────────────────────────────────────────────
const beforeDup = (await cfg()).modelPresets;
await typeAndEnter(lastInput(), NAME);
await sleep(600);
const afterDup = (await cfg()).modelPresets;
const dupState = { same: JSON.stringify(beforeDup) === JSON.stringify(afterDup), len: afterDup.length };

// ── ③ 空行不写盘 ────────────────────────────────────────────────────────
const beforeBlank = (await cfg()).modelPresets;
await typeAndEnter(lastInput(), '   ');
await sleep(600);
const afterBlank = (await cfg()).modelPresets;
const blankState = { same: JSON.stringify(beforeBlank) === JSON.stringify(afterBlank) };

// ── ④ 改一行：首尾空白应当被清掉 ────────────────────────────────────────
const target = rows()[0].querySelector('input.preset-name');
await typeAndEnter(target, '  ' + before[0] + '  ');
await sleep(600);
const afterTrim = (await cfg()).modelPresets;
const trimState = { first: afterTrim[0], clean: afterTrim[0] === before[0], len: afterTrim.length };

// ── ⑤ 叉删掉刚加的那一条 ────────────────────────────────────────────────
const idx = rows().length - 2; // 最后一行是空槽
const dropBtn = rows()[idx].querySelector('button.preset-drop');
const dropW = Math.round(dropBtn.getBoundingClientRect().width);
dropBtn.click();
await sleep(600);
const afterDrop = (await cfg()).modelPresets;
const dropState = {
  dropW,
  backTo: JSON.stringify(afterDrop) === JSON.stringify(before),
  len: afterDrop.length,
  gone: !afterDrop.includes(NAME),
};

// ── ⑥ 还原（无论前面成没成）────────────────────────────────────────────
await fetch('/api/config', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ modelPresets: before }),
});
await sleep(200);
const restored = (await cfg()).modelPresets;

return {
  before,
  geo,
  addState,
  dupState,
  blankState,
  trimState,
  dropState,
  restoredSame: JSON.stringify(restored) === JSON.stringify(before),
};
