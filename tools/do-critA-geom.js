// ── 1. geometry ───────────────────────────────────────────────────────────
const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
const cs = (el, ...props) => { if (!el) return null; const c = getComputedStyle(el); const o = {}; for (const p of props) o[p] = c[p]; return o; };

const pick = document.querySelector('.model-pick');
pick.scrollIntoView({ block: 'center' });
await new Promise(r => setTimeout(r, 300));

const input = document.querySelector('.mp-input');
const grid = document.querySelector('.mp-grid');
const cells = [...document.querySelectorAll('.mp-cell')];
const out = {};

out.inputRect = R(input);
out.gridRect = R(grid);
out.gridStyle = cs(grid, 'maxHeight', 'overflowY', 'display', 'gridTemplateColumns');
out.gridScrollHeight = grid.scrollHeight;
out.gridClientHeight = grid.clientHeight;
out.cellCount = cells.length;
out.cellRects = cells.map(R);
out.cellRowHeights = cells.map(c => +c.getBoundingClientRect().height.toFixed(2));
out.cellTexts = cells.map(c => c.querySelector('.mp-name').textContent);
out.dotRect = R(document.querySelector('.mp-dot'));
out.dotStyle = cs(document.querySelector('.mp-dot'), 'width', 'height', 'borderWidth');
out.mpNameStyle = cs(document.querySelector('.mp-name'), 'fontFamily', 'fontSize', 'overflow', 'textOverflow');
out.mpCellFont = cs(cells[0], 'fontFamily', 'fontSize', 'color', 'backgroundColor');
out.inputFont = cs(input, 'fontFamily', 'fontSize', 'color', 'backgroundColor', 'padding');
out.inputAttrs = { type: input.type, placeholder: input.placeholder, value: input.value, id: input.id, role: input.getAttribute('role'), ariaLabel: input.getAttribute('aria-label'), ariaAuto: input.getAttribute('aria-autocomplete'), ariaExpanded: input.getAttribute('aria-expanded'), ariaControls: input.getAttribute('aria-controls') };
out.labelFor = input.labels && input.labels[0] ? input.labels[0].textContent : null;
out.inputRectTop = R(input).y;

// how many rows visible without scrolling
const gridTop = grid.getBoundingClientRect().top, gridBot = grid.getBoundingClientRect().bottom;
out.rowsFullyVisible = cells.filter(c => { const r = c.getBoundingClientRect(); return r.top >= gridTop - 0.5 && r.bottom <= gridBot + 0.5; }).length;
out.rowsPartiallyVisible = cells.filter(c => { const r = c.getBoundingClientRect(); return r.bottom > gridTop && r.top < gridBot; }).length;

// ── 2. overlay / occlusion ────────────────────────────────────────────────
const mid = cells.length ? cells[Math.floor(cells.length / 2)] : null;
if (mid) { const r = mid.getBoundingClientRect(); out.topElAtCellCenter = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.className; }
if (grid) { const r = grid.getBoundingClientRect(); out.topElAtGridBottom = document.elementFromPoint(r.left + r.width / 2, r.bottom - 2)?.className; }

// ── 3. run button gate ────────────────────────────────────────────────────
const arm = document.querySelector('.btn.arm.xl.wide');
out.armButton = arm ? { disabled: arm.disabled, title: arm.getAttribute('title'), text: arm.textContent, rect: R(arm) } : null;
if (arm) out.armStyle = cs(arm, 'color', 'backgroundColor', 'borderTopColor', 'cursor', 'opacity');

// ── 4. structural validity ────────────────────────────────────────────────
out.gridChildren = [...grid.children].map(c => ({ tag: c.tagName, cls: c.className, role: c.getAttribute('role'), ariaSelected: c.getAttribute('aria-selected'), tabIndex: c.tabIndex }));
out.ariaActiveDescendant = grid.getAttribute('aria-activedescendant');
out.inputTabIndex = input.tabIndex;
out.docTabOrderAroundInput = (() => {
  const all = [...document.querySelectorAll('button, input, select, textarea, a[href], summary, [tabindex]:not([tabindex="-1"])')];
  const idx = all.indexOf(input);
  return { idx, total: all.length, next5: all.slice(idx + 1, idx + 6).map(e => `${e.tagName}.${(e.className || '').toString().slice(0, 28)}#${e.id || '-'}`) };
})();

// colour sampling helpers
function parse(c) { const m = c.match(/[\d.]+/g).map(Number); return m; }
function lum([r, g, b]) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function ratio(a, b) { const l1 = lum(a), l2 = lum(b); return +(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))).toFixed(2); }
const cellColor = parse(cs(cells[0], 'color').color);
const wellBg = parse(cs(cells[0], 'backgroundColor').backgroundColor);
out.contrastCellText = cells[0] ? { fg: cs(cells[0], 'color').color, bg: cs(cells[0], 'backgroundColor').backgroundColor, ratio: ratio(cellColor, wellBg) } : null;
out.contrastInputPlaceholder = cs(input, 'color').color;
out.contrastEmpty = (() => {
  const e = document.querySelector('.mp-empty');
  return e ? { color: cs(e, 'color').color, bg: cs(e.parentElement, 'backgroundColor').backgroundColor, h: R(e).h } : null;
})();

// selected row contrast: temporarily select first
cells[0].click();
await new Promise(r => setTimeout(r, 250));
const sel = document.querySelector('.mp-cell[aria-selected="true"]');
out.selectedAfterClick = sel ? { text: sel.querySelector('.mp-name').textContent, inputValue: document.querySelector('.mp-input').value, ariaSelected: sel.getAttribute('aria-selected'), fg: cs(sel, 'color').color, bg: cs(sel, 'backgroundColor').backgroundColor, ratio: ratio(parse(cs(sel, 'color').color), parse(cs(sel, 'backgroundColor').backgroundColor)), dotShadow: cs(sel.querySelector('.mp-dot')?.pseudo ? sel : sel, 'color').color } : null;
out.selectedCount = document.querySelectorAll('.mp-cell[aria-selected="true"]').length;
out.dotAfterStyle = (() => { const d = sel && sel.querySelector('.mp-dot'); return d ? { w: R(d).w, h: R(d).h, border: cs(d, 'borderTopColor').borderTopColor } : null; })();

// ── 5. gate after select ──────────────────────────────────────────────────
const arm2 = document.querySelector('.btn.arm.xl.wide');
out.armAfterSelect = arm2 ? { disabled: arm2.disabled, title: arm2.getAttribute('title') } : null;

// ── 6. filter behaviour ───────────────────────────────────────────────────
async function type(v) {
  const i = document.querySelector('.mp-input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(i, v);
  i.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));
  return [...document.querySelectorAll('.mp-cell .mp-name')].map(e => e.textContent);
}
out.filter_dsr = await type('dsr');
out.filter_DEEPSEEK_upper = await type('DEEPSEEK');
out.filter_spaces = await type('d s r');
out.filter_zzz = await type('zzz');
out.emptyState = (() => { const e = document.querySelector('.mp-empty'); const g = document.querySelector('.mp-grid'); return e ? { text: e.textContent, rect: R(e), gridH: R(g).h, cellCount: document.querySelectorAll('.mp-cell').length } : { absent: true, gridH: R(g).h }; })();
out.filter_longq = await type('deepseek-v3.2-reasoner-preview-extended-extra-long-query-string');
out.filter_longq_hits = document.querySelectorAll('.mp-cell').length;
out.filter_arbitrary = await type('my-custom-model-v9');
out.arbitraryEmpty = !!document.querySelector('.mp-empty');
out.arbitraryValueInInput = document.querySelector('.mp-input').value;
const arm3 = document.querySelector('.btn.arm.xl.wide');
out.armAfterArbitrary = arm3 ? { disabled: arm3.disabled, title: arm3.getAttribute('title') } : null;

// long model name ellipsis
out.longName = await type('');
await type('kimi');
await new Promise(r => setTimeout(r, 150));
const kc = document.querySelector('.mp-cell .mp-name');
out.ellipsisCheck = kc ? { scrollW: kc.scrollWidth, clientW: kc.clientWidth, ellipsized: kc.scrollWidth > kc.clientWidth } : null;

// ── 7. keyboard ───────────────────────────────────────────────────────────
await type('');
const inp = document.querySelector('.mp-input');
inp.focus();
out.focusOnInput = document.activeElement === inp;
function key(el, k, opts = {}) { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts })); }
const before = { active: document.activeElement.className, inputValue: document.querySelector('.mp-input').value, selCount: document.querySelectorAll('.mp-cell[aria-selected="true"]').length };
key(inp, 'ArrowDown');
await new Promise(r => setTimeout(r, 200));
out.afterArrowDown = { active: document.activeElement.tagName + '.' + document.activeElement.className, inputValue: document.querySelector('.mp-input').value };
key(inp, 'Enter');
await new Promise(r => setTimeout(r, 200));
out.afterEnter = { active: document.activeElement.tagName + '.' + document.activeElement.className, inputValue: document.querySelector('.mp-input').value };
key(document.body, 'Tab');
await new Promise(r => setTimeout(r, 150));
out.afterTabFromInput = document.activeElement.tagName + '.' + document.activeElement.className + '#' + (document.activeElement.id || '-');
out.cellsTabIndex = [...document.querySelectorAll('.mp-cell')].map(c => c.tabIndex);
out.cellsTabbable = [...document.querySelectorAll('.mp-cell')].filter(c => c.tabIndex >= 0).length;

// count Tabs from input to arm button
inp.focus();
await new Promise(r => setTimeout(r, 100));
const seq = [];
let hop = 0;
while (hop < 25) {
  const cur = document.activeElement;
  const all = [...document.querySelectorAll('button, input, select, textarea, a[href], summary, [tabindex]:not([tabindex="-1"])')].filter(e => !e.disabled && e.offsetParent !== null);
  const idx = all.indexOf(cur);
  if (idx < 0) { seq.push('unreachable:' + cur.tagName); break; }
  const nxt = all[idx + 1];
  if (!nxt) break;
  seq.push(`${nxt.tagName}.${(nxt.className || '').toString().slice(0, 30)}#${nxt.id || '-'}`);
  if (nxt.classList.contains('arm')) { out.tabsFromInputToArm = seq.length; break; }
  nxt.focus();
  hop += 1;
}
out.tabSeqFromInput = seq.slice(0, 12);

return out;
