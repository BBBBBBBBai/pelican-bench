const out = {};
const g = (s) => document.querySelector(s);
const ga = (s) => [...document.querySelectorAll(s)];
const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [+r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)]; };
const cs = (el, ...p) => { if (!el) return null; const c = getComputedStyle(el); const o = {}; for (const k of p) o[k] = c[k]; return o; };
const rgb = (s) => { const m = String(s).match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : null; };
const lum = ([r, gg, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b); };
const cr = (a, b) => { const l1 = lum(a), l2 = lum(b); return +((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2); };

// scroll model-pick into the rail view
const pick = g('.model-pick');
pick.scrollIntoView({ block: 'center' });
await new Promise(r => setTimeout(r, 300));

const input = g('.mp-input'), grid = g('.mp-grid');
out.A_geometry = {
  input: R(input),
  inputPad: cs(input, 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderTopColor'),
  grid: R(grid),
  gridCss: cs(grid, 'maxHeight', 'overflowY', 'gap', 'background', 'borderTopWidth', 'borderTopColor', 'boxShadow'),
  gridScrollH: grid.scrollHeight, gridClientH: grid.clientHeight,
  cellCount: ga('.mp-cell').length,
  cellH: ga('.mp-cell').map(c => +c.getBoundingClientRect().height.toFixed(2)),
  cellW: ga('.mp-cell').map(c => +c.getBoundingClientRect().width.toFixed(2)),
  dot: R(g('.mp-dot')), dotCss: cs(g('.mp-dot'), 'width', 'height', 'borderTopWidth', 'borderTopColor', 'background'),
  cellPad: cs(g('.mp-cell'), 'paddingTop', 'paddingBottom', 'paddingLeft', 'fontSize', 'lineHeight', 'gap'),
  emptyCandidateRows: ga('.mp-cell').filter(c => !c.querySelector('.mp-name').textContent.trim()).length,
  exactEmptyRowCount: (() => { let n = 0; for (const c of ga('.mp-cell')) if (c.querySelector('.mp-name').textContent === '') n += 1; return n; })(),
};
// visible rows at the default scroll position
{
  const gb = grid.getBoundingClientRect();
  const rows = ga('.mp-cell');
  out.A_geometry.rowsFullyVisible = rows.filter(c => { const r = c.getBoundingClientRect(); return r.top >= gb.top - 0.5 && r.bottom <= gb.bottom + 0.5; }).length;
  out.A_geometry.rowsClippedAtBottom = rows.filter(c => c.getBoundingClientRect().bottom > gb.bottom + 0.5).length;
  out.A_geometry.hiddenBelowPx = grid.scrollHeight - grid.clientHeight;
}

// contrast
out.B_contrast = {
  cellTextOnWell: { fg: cs(g('.mp-cell'), 'color').color, bg: cs(g('.mp-cell'), 'backgroundColor').backgroundColor, ratio: cr(rgb(cs(g('.mp-cell'), 'color').color), rgb(cs(g('.mp-cell'), 'backgroundColor').backgroundColor)) },
  inputText: { fg: cs(input, 'color').color, bg: cs(input, 'backgroundColor').backgroundColor, ratio: cr(rgb(cs(input, 'color').color), rgb(cs(input, 'backgroundColor').backgroundColor)) },
  label: (() => { const l = document.querySelector('label[for="o-model"]'); return { fg: cs(l, 'color').color, ratio: cr(rgb(cs(l, 'color').color), rgb(cs(l.parentElement, 'backgroundColor').backgroundColor)), text: l.textContent }; })(),
  placeholder: (() => { const s = [...document.styleSheets].flatMap(sh => { try { return [...sh.cssRules]; } catch { return []; } }); const rule = s.find(r => r.selectorText && r.selectorText.includes('placeholder')); return rule ? rule.style.color || rule.cssText : null; })(),
  hintNote: (() => { const n = ga('.note').find(e => e.textContent.includes('先定一个模型名')); return n ? { fg: cs(n, 'color').color, ratio: cr(rgb(cs(n, 'color').color), rgb(cs(n.parentElement, 'backgroundColor').backgroundColor)), fontSize: cs(n, 'fontSize').fontSize, text: n.textContent } : null; })(),
};

// selected state
{
  const cells = ga('.mp-cell');
  const target = cells.find(c => c.querySelector('.mp-name').textContent.includes('deepseek')) || cells[0];
  target.click();
  await new Promise(r => setTimeout(r, 250));
  const sel = g('.mp-cell[aria-selected="true"]');
  const dot = sel.querySelector('.mp-dot');
  const after = getComputedStyle(dot, '::after');
  out.C_selected = {
    clickedText: target.querySelector('.mp-name').textContent,
    inputValue: input.value,
    selectedCount: ga('.mp-cell[aria-selected="true"]').length,
    selFg: cs(sel, 'color').color, selBg: cs(sel, 'backgroundColor').backgroundColor,
    selRatio: cr(rgb(cs(sel, 'color').color), rgb(cs(sel, 'backgroundColor').color ? cs(sel, 'backgroundColor').backgroundColor : '#0b0b0a')),
    dotInner: { w: after.width, h: after.height, bg: after.backgroundColor, boxShadow: after.boxShadow },
    nonSelectedDot: (() => { const d = ga('.mp-cell')[0].querySelector('.mp-dot'); return { bg: getComputedStyle(d).backgroundColor, border: getComputedStyle(d).borderTopColor, w: d.getBoundingClientRect().width }; })(),
    rowHeightsUnchanged: [...new Set(ga('.mp-cell').map(c => +c.getBoundingClientRect().height.toFixed(2)))],
    selCellW: +sel.getBoundingClientRect().width.toFixed(2),
    unselCellW: +ga('.mp-cell')[0].getBoundingClientRect().width.toFixed(2),
    // is the input still showing a "selection" affordance distinct from search?
    inputAttrs: { role: input.getAttribute('role'), ariaActivedescendant: grid.getAttribute('aria-activedescendant'), ariaSelected: input.getAttribute('aria-selected') },
  };
  out.C_selected.armGate = (() => { const b = g('.btn.arm.xl.wide'); return { disabled: b.disabled, title: b.getAttribute('title'), ariaDisabled: b.getAttribute('aria-disabled') }; })();
}

// autofocus / re-entrancy: click a cell then check scroll position preserved
{
  const before = grid.scrollTop;
  ga('.mp-cell').slice(-1)[0].click();
  await new Promise(r => setTimeout(r, 200));
  out.D_scroll = { before, after: grid.scrollTop, preserved: before === grid.scrollTop };
}

// type=search behaviours
const setVal = async (v) => {
  const i = g('.mp-input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 180));
  return ga('.mp-cell .mp-name').map(e => e.textContent);
};
out.E_filter = {
  dsr: await setVal('dsr'),
  uppercase: await setVal('DSR'),
  withSpaces: await setVal('d s r'),
  chinese: await setVal('深度求索'),
  zzz: await setVal('zzz'),
  zzzGridH: R(g('.mp-grid')),
  zzzEmptyText: g('.mp-empty')?.textContent,
  zzzEmptyCellH: R(g('.mp-empty')),
  zzzArm: (() => { const b = g('.btn.arm.xl.wide'); return { disabled: b.disabled, title: b.getAttribute('title'), ariaDisabled: b.getAttribute('aria-disabled') }; })(),
  qLongerThanAnyCandidate: await setVal('deepseek-v3.2-reasoner-preview-ultra-extra'),
  qLongerCount: ga('.mp-cell').length,
  // subsequence matcher pathology: query with a char not in candidate but greedy consumed
  pathologyDotdash: await setVal('g6.1sol'),
  arbitraryName: await setVal('my-own-model-v9'),
  arbitraryCount: ga('.mp-cell').length,
  arbitraryEmpty: !!g('.mp-empty'),
  arbitraryArm: (() => { const b = g('.btn.arm.xl.wide'); return { disabled: b.disabled, title: b.getAttribute('title') }; })(),
  backToEmpty: await setVal(''),
};
// is there a "clear" affordance? does Esc clear?
{
  const i = g('.mp-input');
  i.focus(); i.value = 'zzz';
  i.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 150));
  i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise(r => setTimeout(r, 150));
  out.F_escape = { valueAfterEsc: i.value, cells: ga('.mp-cell').length };
}
return out;
