// Trap check: the field is BOTH the filter and the value. Can a filter fragment be submitted?
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const setVal = (el, v) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

const input = document.getElementById('o-model');
const grid = document.querySelector('.mp-grid');
const runBtn = [...document.querySelectorAll('button')].find((b) =>
  (b.textContent || '').includes('开始生成'),
);

const snap = () => ({
  value: input.value,
  rows: document.querySelectorAll('.mp-cell').length,
  names: [...document.querySelectorAll('.mp-cell .mp-name')].map((n) => n.textContent),
  gridH: Math.round(grid.getBoundingClientRect().height),
  runDisabled: runBtn ? runBtn.disabled : null,
  runTitle: runBtn ? runBtn.title || null : null,
  focused: document.activeElement && (document.activeElement.id || document.activeElement.tagName),
});

const out = {};

// 1) empty query -> full list
setVal(input, '');
await wait(350);
out.empty = snap();

// 2) a filter FRAGMENT, never picked from the list
setVal(input, 'dsr');
await wait(350);
out.fragment = snap();

// is the fragment accepted by the run gate? (只有非空才拦)
// 3) now actually click the one remaining row, then look at the list again
const cell = document.querySelector('.mp-cell');
if (cell) cell.click();
await wait(400);
out.afterPick = snap();
out.afterPickFocusTag = document.activeElement ? document.activeElement.tagName : null;

// 4) can the user get the full list back without destroying the value?
setVal(input, '');
await wait(350);
out.cleared = snap();

// 5) case where a fragment matches several rows and the user tabs away
setVal(input, 'g');
await wait(350);
out.broadFragment = snap();

// 6) does the grid expose any scroll affordance / does it clip?
const gcs = getComputedStyle(grid);
out.gridScroll = {
  scrollHeight: grid.scrollHeight,
  clientHeight: grid.clientHeight,
  hiddenRows: Math.round((grid.scrollHeight - grid.clientHeight) / 29),
  overflowY: gcs.overflowY,
  paddingBottom: gcs.paddingBottom,
  hasFade: !!document.querySelector('.mp-grid::after'),
};
out.rowsOutOfView = [...document.querySelectorAll('.mp-cell')]
  .map((c, i) => {
    const r = c.getBoundingClientRect();
    const g = grid.getBoundingClientRect();
    return r.bottom > g.bottom + 1 ? i : -1;
  })
  .filter((i) => i >= 0);

// 7) accessible name of the listbox vs the visible label
const listbox = document.querySelector('[role="listbox"]');
const label = document.querySelector('label[for="o-model"]');
out.names = {
  listboxAriaLabel: listbox ? listbox.getAttribute('aria-label') : null,
  visibleLabel: label ? label.textContent : null,
  inputAriaLabel: input.getAttribute('aria-label'),
  inputRole: input.getAttribute('role'),
};

return out;
