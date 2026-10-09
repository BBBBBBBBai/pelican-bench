const out = {};
const g = (s) => document.querySelector(s);
const ga = (s) => [...document.querySelectorAll(s)];
const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [+r.width.toFixed(1), +r.height.toFixed(1)]; };
g('.model-pick').scrollIntoView({ block: 'center' });
await new Promise(r => setTimeout(r, 300));

// tap-target audit for the module only
out.cells = ga('.mp-cell').map(c => ({ h: +c.getBoundingClientRect().height.toFixed(1), w: +c.getBoundingClientRect().width.toFixed(1) }));
const dot = g('.mp-dot');
out.dot = dot ? { w: +dot.getBoundingClientRect().width.toFixed(1), h: +dot.getBoundingClientRect().height.toFixed(1), bg: getComputedStyle(dot).borderTopColor, selected: dot.parentElement.getAttribute('aria-selected') } : null;

// horizontal overflow of a long name inside the row at this width
const names = ga('.mp-cell .mp-name').map(n => ({ text: n.textContent, clip: n.scrollWidth > n.clientWidth, sw: n.scrollWidth, cw: n.clientWidth }));
out.nameClipping = names;

// does the row's accessible name include the dot? and is selected conveyed beyond colour?
const first = ga('.mp-cell')[0];
out.rowA11y = { accName: first.textContent, ariaSelected: first.getAttribute('aria-selected'), role: first.getAttribute('role'), dotHasText: (first.querySelector('.mp-dot')?.textContent || '').length };

// VIRTUAL selection highlight: set input to a full name WITHOUT clicking a row (the "typed exact name" case)
{
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const target = ga('.mp-cell .mp-name')[1].textContent;
  setter.call(g('.mp-input'), target); g('.mp-input').dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 250));
  out.typedExact = { typed: target, rows: ga('.mp-cell').length, selRows: ga('.mp-cell[aria-selected="true"]').length,
    selText: ga('.mp-cell[aria-selected="true"] .mp-name').map(e => e.textContent) };
}

// empty-state visual weight: what does the grid look like when nothing matches
{
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(g('.mp-input'), 'zzzz'); g('.mp-input').dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 250));
  const em = g('.mp-empty');
  out.empty = { h: +em.getBoundingClientRect().height.toFixed(1), color: getComputedStyle(em).color, bg: getComputedStyle(em).backgroundColor,
    gridBg: getComputedStyle(g('.mp-grid')).backgroundColor, text: em.textContent,
    armDisabled: g('.btn.arm.xl.wide')?.disabled, armTitle: g('.btn.arm.xl.wide')?.getAttribute('title') };
}

// RESET for the screenshot: clear then focus
{
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(g('.mp-input'), ''); g('.mp-input').dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));
  g('.mp-input').focus();
}
return out;
