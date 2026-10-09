// Focus/contrast/blank-row/gate probe.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mp = document.querySelector('.model-pick');
if (mp) mp.scrollIntoView({ block: 'center' });
await wait(300);

const input = document.querySelector('#o-model');
const setVal = (v) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, v);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const lum = (c) => {
  const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(Number).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return +((x + 0.05) / (y + 0.05)).toFixed(2);
};

const out = {};

// 1. blank rows
const cells = [...document.querySelectorAll('.mp-cell')];
out.blankRows = cells
  .map((c, i) => ({ i, name: c.querySelector('.mp-name')?.textContent ?? null, h: Math.round(c.getBoundingClientRect().height) }))
  .filter((x) => x.name === '');

// 2. focus ring on a candidate cell
cells[0].focus();
await wait(120);
const cs = getComputedStyle(cells[0]);
out.focusRing = {
  activeIsCell: document.activeElement === cells[0],
  outline: cs.outlineWidth + ' ' + cs.outlineStyle + ' ' + cs.outlineColor,
  outlineOffset: cs.outlineOffset,
  boxShadow: cs.boxShadow,
  bg: cs.backgroundColor,
};
out.focusRingInput = (() => {
  input.focus();
  const s = getComputedStyle(input);
  return { outline: s.outlineWidth + ' ' + s.outlineStyle + ' ' + s.outlineColor };
})();

// 3. contrast: unselected + selected row
await wait(80);
const unsel = getComputedStyle(cells[0]);
out.contrast = {
  unselected: { fg: unsel.color, bg: unsel.backgroundColor, ratio: ratio(unsel.color, unsel.backgroundColor), fs: unsel.fontSize },
};
cells[5].click();
await wait(150);
const selCell = [...document.querySelectorAll('.mp-cell')].find((c) => c.getAttribute('aria-selected') === 'true') || cells[5];
const ss = getComputedStyle(selCell);
out.contrast.selected = { fg: ss.color, bg: ss.backgroundColor, ratio: ratio(ss.color, ss.backgroundColor), fs: ss.fontSize, name: selCell.textContent };
const dot = selCell.querySelector('.mp-dot');
if (dot) {
  const ds = getComputedStyle(dot);
  const after = getComputedStyle(dot, '::after');
  out.selectedDot = { border: ds.borderColor, afterBg: after.backgroundColor, afterShadow: after.boxShadow, afterW: after.width, afterH: after.height };
}

// 4. gate: clear the model, check disabled + title
setVal('');
await wait(200);
const runBtn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('开始生成'));
out.gateEmptyModel = runBtn ? { disabled: runBtn.disabled, title: runBtn.getAttribute('title'), cls: runBtn.className } : null;

// 5. how many rows visible in the 220px well
const grid = document.querySelector('.mp-grid');
out.grid = grid ? { clientH: grid.clientHeight, scrollH: grid.scrollHeight, rowsVisible: +(grid.clientHeight / 29).toFixed(1), totalRows: grid.children.length } : null;
// scroll to bottom, capture
grid.scrollTop = grid.scrollHeight;

// 6. tab reachability of candidate rows
out.tabIndexes = [...document.querySelectorAll('.mp-cell')].map((c) => c.tabIndex);
out.listboxAria = {
  role: grid.getAttribute('role'),
  ariaLabel: grid.getAttribute('aria-label'),
  labelledBy: grid.getAttribute('aria-labelledby'),
  childRoles: [...grid.children].map((c) => c.tagName.toLowerCase() + ':' + (c.getAttribute('role') || 'none')),
  inputRole: input.getAttribute('role'),
  inputAria: [...input.attributes].filter((a) => a.name.startsWith('aria')).map((a) => a.name + '=' + a.value),
};
return out;
