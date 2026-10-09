// Does an empty-but-typed query leave the list usable, and is there any signal of "not a real model"?
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

const out = {};

// The gate only checks non-empty. Type a fragment that matches nothing real,
// but that is a plausible typo, and see what the UI tells the user.
setVal(input, 'gpt-7');
await wait(300);
out.typo = {
  value: input.value,
  rows: document.querySelectorAll('.mp-cell').length,
  emptyText: document.querySelector('.mp-empty')?.textContent ?? null,
  runDisabled: runBtn.disabled,
  runTitle: runBtn.title || null,
};

// The hint claims you must "先定一个模型名". Does the UI enforce or signal that?
setVal(input, 'does-not-exist');
await wait(300);
out.bogus = {
  value: input.value,
  rows: document.querySelectorAll('.mp-cell').length,
  emptyText: document.querySelector('.mp-empty')?.textContent ?? null,
  runDisabled: runBtn.disabled,
  runTitle: runBtn.title || null,
  ariaInvalid: input.getAttribute('aria-invalid'),
};

// provider is selected? (gate has two halves)
out.gate = {
  runDisabledWhenOnlyModelMissing: runBtn.disabled,
};

// Does the picker advertise which provider the name belongs to?
out.context = {
  selectedProviderText: document.querySelector('.slot-name')?.textContent ?? null,
  gridHasAnyProviderScope: !!grid.querySelector('[data-provider], [aria-describedby]'),
  hintText: document.querySelector('.model-pick ~ .note')?.textContent ?? null,
};

// scroll affordance: is the thumb visible above the groove?
const gcs = getComputedStyle(grid);
const cvs = document.createElement('canvas');
out.scrollbar = {
  scrollbarWidth: gcs.scrollbarWidth,
  scrollbarColor: gcs.scrollbarColor,
  hiddenRows: Math.max(0, Math.round((grid.scrollHeight - grid.clientHeight) / 29)),
  scrollHeight: grid.scrollHeight,
  clientHeight: grid.clientHeight,
};

// does the grid ever exceed its window with the default (empty) query?
out.defaultVisibleRows = (() => {
  setVal(input, '');
  return null;
})();

return out;
