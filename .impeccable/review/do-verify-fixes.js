// 复测 5 条修复：P0 门禁可见性 / P1 焦点环与键盘通道 / P1 拆 query 与 value
// / P2 空态 / P2 固定 220px。用 node tools/edge-cdp.mjs probe <url> --width=1440 --height=900 --do=<this>
const out = {};
const q = (s) => document.querySelector(s);
const qa = (s) => Array.from(document.querySelectorAll(s));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const setVal = (el, v) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const lum = (c) => {
  const m = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  const f = m.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
};
const ratio = (fg, bg) => {
  const a = lum(fg), b = lum(bg);
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
};

const input = q('#o-model');
const grid = q('#mp-grid');
const runBtn = q('.btn.arm');
const top = (el) => Math.round(el.getBoundingClientRect().top * 10) / 10;

// ── 1. 初始态 ────────────────────────────────────────────────────────────
out.initial = {
  inputValue: input.value,
  rows: qa('.mp-cell').length,
  gridClientH: grid.clientHeight,
  gridOffsetH: grid.offsetHeight,
  gridScrollH: grid.scrollHeight,
  gridScrollableBy: grid.scrollHeight - grid.clientHeight,
  gridBackground: getComputedStyle(grid).backgroundColor,
  runTop: top(runBtn),
  runDisabled: runBtn.disabled,
  gateStatusText: (q('.mp-status') || {}).textContent,
  clearPresent: !!q('.mp-clear'),
  clearDisabled: q('.mp-clear') ? q('.mp-clear').disabled : null,
  clearAriaLabel: q('.mp-clear') ? q('.mp-clear').getAttribute('aria-label') : null,
};

// ── 2. P0：门禁态与放行态是不是长得不一样 ───────────────────────────────
const armStyle = (el) => {
  const s = getComputedStyle(el);
  return { color: s.color, borderColor: s.borderColor, background: s.backgroundColor, opacity: s.opacity, cursor: s.cursor };
};
out.gate = { blocked: { disabled: runBtn.disabled, ...armStyle(runBtn) } };
setVal(input, 'gpt-6.1');
await wait(60);
out.gate.allowed = { disabled: runBtn.disabled, ...armStyle(runBtn) };
out.gate.statusWhenAllowed = (q('.mp-status') || {}).textContent;
setVal(input, '');
await wait(60);

// ── 3. P2：空态的底、字体、对比度，以及它在不在 listbox 里 ──────────────
setVal(input, 'zzz');
await wait(60);
const emptyEl = q('.mp-empty');
const es = emptyEl ? getComputedStyle(emptyEl) : null;
const esBg = es ? es.backgroundColor : null;
out.emptyState = {
  rows: qa('.mp-cell').length,
  present: !!emptyEl,
  text: emptyEl ? emptyEl.textContent : null,
  role: emptyEl ? emptyEl.getAttribute('role') : null,
  parentId: emptyEl ? emptyEl.parentElement.id : null,
  insideListbox: emptyEl ? !!emptyEl.closest('[role=listbox]') : null,
  fontFamily: es ? es.fontFamily : null,
  fontSize: es ? es.fontSize : null,
  color: es ? es.color : null,
  // 空态自己是透明的，底其实是它下面那张表的 --well
  effectiveBg: esBg === 'rgba(0, 0, 0, 0)' ? getComputedStyle(grid).backgroundColor : esBg,
  gridClientHWhenEmpty: grid.clientHeight,
  runTopWhenEmpty: top(runBtn),
  runDisabledWhenEmpty: runBtn.disabled,
};
out.emptyState.contrast = ratio(out.emptyState.color, out.emptyState.effectiveBg);

// ── 4. P2：过滤时按钮还动不动 ───────────────────────────────────────────
const tops = [];
for (const v of ['', 'd', 'dsr', 'g', 'zzz', 'gpt-6.1-sol', 'kimi']) {
  setVal(input, v);
  await wait(50);
  tops.push({ typed: v, runTop: top(runBtn), rows: qa('.mp-cell').length, gridH: grid.clientHeight });
}
out.layoutStability = {
  samples: tops,
  distinctRunTops: [...new Set(tops.map((t) => t.runTop))],
  runBtnTravelPx: Math.max(...tops.map((t) => t.runTop)) - Math.min(...tops.map((t) => t.runTop)),
};

// ── 5. P1：拆开 query 与 value —— 点一行之后便签还在不在 ────────────────
setVal(input, 'dsr');
await wait(50);
const filteredRows = qa('.mp-cell').length;
const firstCell = q('.mp-cell');
const firstName = firstCell.querySelector('.mp-name').textContent;
firstCell.click();
await wait(60);
out.commit = {
  typedFragment: 'dsr',
  rowsWhileTyping: filteredRows,
  clicked: firstName,
  inputAfterClick: input.value,
  rowsAfterClick: qa('.mp-cell').length,
  selectedRowsAfterClick: qa('.mp-cell[aria-selected=true]').length,
  selectedNameAfterClick: (q('.mp-cell[aria-selected=true] .mp-name') || {}).textContent,
  runDisabledAfterClick: runBtn.disabled,
  runTopAfterClick: top(runBtn),
};

// ── 6. P1：清除控件 ─────────────────────────────────────────────────────
const clearBtn = q('.mp-clear');
out.clear = { before: input.value, clearDisabledBefore: clearBtn.disabled };
clearBtn.click();
await wait(60);
out.clear.after = {
  inputValue: input.value,
  rows: qa('.mp-cell').length,
  selectedRows: qa('.mp-cell[aria-selected=true]').length,
  runDisabled: runBtn.disabled,
  clearDisabled: q('.mp-clear').disabled,
  gateStatusText: (q('.mp-status') || {}).textContent,
};

// ── 7. P3：ARIA 契约 ────────────────────────────────────────────────────
setVal(input, 'gpt');
await wait(50);
out.aria = {
  input: {
    role: input.getAttribute('role'),
    expanded: input.getAttribute('aria-expanded'),
    controls: input.getAttribute('aria-controls'),
    autocomplete: input.getAttribute('aria-autocomplete'),
    activedescendant: input.getAttribute('aria-activedescendant'),
    describedby: input.getAttribute('aria-describedby'),
    autocompleteAttr: input.getAttribute('autocomplete'),
    spellcheck: input.getAttribute('spellcheck'),
  },
  listbox: {
    id: grid.id,
    role: grid.getAttribute('role'),
    ariaLabel: grid.getAttribute('aria-label'),
    visibleLabel: q('label[for=o-model]').textContent,
    tabIndex: grid.tabIndex,
  },
  optionTabIndexes: qa('.mp-cell').map((e) => e.tabIndex),
  ariaLiveCount: document.querySelectorAll('[aria-live]').length,
  roleStatusCount: document.querySelectorAll('[role=status]').length,
  activeDescendantResolves: (() => {
    const id = input.getAttribute('aria-activedescendant');
    return id ? !!document.getElementById(id) : 'absent';
  })(),
};
setVal(input, '');
await wait(60);

// ── 8. 行高与刻缝：换成 inset 阴影之后几何有没有变 ──────────────────────
const cells = qa('.mp-cell');
const rects = cells.map((e) => e.getBoundingClientRect());
out.rows = {
  count: cells.length,
  heights: [...new Set(rects.map((r) => Math.round(r.height * 10) / 10))],
  stepBetweenTops: [...new Set(rects.slice(1).map((r, i) => Math.round((r.top - rects[i].top) * 10) / 10))],
  gridRect: (() => { const r = grid.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
  cellWidth: Math.round(rects[0].width),
  gridContentWidth: grid.clientWidth - 0,
};

return out;
