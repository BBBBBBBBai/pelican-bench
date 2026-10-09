const g = (s) => document.querySelector(s);
const ga = (s) => [...document.querySelectorAll(s)];
g('.model-pick').scrollIntoView({ block: 'center' });
await new Promise(r => setTimeout(r, 300));
const R = (el) => { const r = el.getBoundingClientRect(); return [+r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)]; };
// zoom the picker for a legible crop: scale up around the module
// pick a candidate first so the selected-row treatment is magnified
{
  const i = g('.mp-input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 250));
  ga('.mp-cell')[2].click();
  await new Promise(r => setTimeout(r, 400));
}
const pick = g('.model-pick');
const before = R(pick);
pick.style.transformOrigin = 'top left';
pick.style.transform = 'scale(2.2)';
pick.style.zIndex = '9999';
pick.style.position = 'relative';
pick.style.background = 'var(--panel)';
await new Promise(r => setTimeout(r, 500));
return { before, after: R(pick), rows: ga('.mp-cell').length };
