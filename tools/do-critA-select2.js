const out = {};
const g = (s) => document.querySelector(s);
const ga = (s) => [...document.querySelectorAll(s)];
const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [+r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)]; };
const pick = g('.model-pick'); pick.scrollIntoView({ block: 'center' });
await new Promise(r => setTimeout(r, 300));

out.before = { grid: R(g('.mp-grid')), rows: ga('.mp-cell').length, pick: R(pick) };

// 1) click a candidate
ga('.mp-cell')[5].click();
await new Promise(r => setTimeout(r, 300));
out.afterPick = {
  inputValue: g('.mp-input').value,
  rowsLeft: ga('.mp-cell').length,
  rowTexts: ga('.mp-cell .mp-name').map(e => e.textContent),
  grid: R(g('.mp-grid')),
  pick: R(pick),
  gridScrollH: g('.mp-grid').scrollHeight,
  scrollTop: g('.mp-grid').scrollTop,
  selectedRows: ga('.mp-cell[aria-selected="true"]').length,
  armDisabled: g('.btn.arm.xl.wide')?.disabled,
};

// 2) does the grid still scroll / show others after pick?
out.hiddenAfterPick = g('.mp-grid').scrollHeight - g('.mp-grid').clientHeight;

// 3) clear via Ctrl+A delete -> list returns?
{
  const i = g('.mp-input'); i.focus();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 250));
  out.afterClear = { rows: ga('.mp-cell').length, grid: R(g('.mp-grid')) };
}

// 4) selection by exact string but with whitespace typed
{
  const i = g('.mp-input'); const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(i, ' qwen3-max'); i.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 250));
  out.withLeadingSpace = { value: i.value, rows: ga('.mp-cell').length, selRows: ga('.mp-cell[aria-selected="true"]').length, text: ga('.mp-cell .mp-name').map(e => e.textContent) };
}

// 5) the "select then look" trap: after selecting, are the other 9 reachable without clearing?
{
  const i = g('.mp-input'); const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));
  ga('.mp-cell')[9].click();
  await new Promise(r => setTimeout(r, 250));
  out.afterPick2 = { value: i.value, rows: ga('.mp-cell').length };
}

// 6) type a long arbitrary name -> measure input overflow vs ellipsis
{
  const longName = 'vendor-specific/super-long-model-name-with-a-very-long-suffix-2025-10-08-v3';
  const i = g('.mp-input'); const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(i, longName); i.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 250));
  i.blur();
  out.longInput = { scrollW: i.scrollWidth, clientW: i.clientWidth, overflows: i.scrollWidth > i.clientWidth, value: i.value,
    gridH: R(g('.mp-grid')), emptyText: g('.mp-empty')?.textContent, armDisabled: g('.btn.arm.xl.wide')?.disabled, armTitle: g('.btn.arm.xl.wide')?.getAttribute('title') };
}

// 7) scrollbar styling of .mp-grid
{
  const rules = [...document.styleSheets].flatMap(sh => { try { return [...sh.cssRules]; } catch { return []; } });
  out.scrollbarRules = rules.filter(r => r.cssText && /scrollbar/i.test(r.cssText) && /mp-|model/i.test(r.cssText)).map(r => r.cssText.slice(0, 160));
  out.anyScrollbarRules = rules.filter(r => r.selectorText && /scrollbar/.test(r.selectorText)).map(r => r.selectorText).slice(0, 12);
  out.gridScrollbarColor = getComputedStyle(g('.mp-grid')).scrollbarColor;
  out.gridScrollbarWidth = getComputedStyle(g('.mp-grid')).scrollbarWidth;
  out.gridScrollbarGutter = getComputedStyle(g('.mp-grid')).scrollbarGutter;
}
return out;
