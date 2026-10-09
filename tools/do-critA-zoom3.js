const g = (s) => document.querySelector(s);
g('.model-pick').scrollIntoView({ block: 'center' });
await new Promise(r => setTimeout(r, 300));
const R = (el) => { const r = el.getBoundingClientRect(); return [+r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)]; };
const pick = g('.model-pick');
const before = R(pick);
pick.style.transformOrigin = 'top left';
pick.style.transform = 'scale(2.2)';
pick.style.position = 'relative';
pick.style.background = 'var(--panel)';
await new Promise(r => setTimeout(r, 400));
// empty state: type a miss so the empty cell shows, magnified
const i = g('.mp-input');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(i, 'zzz'); i.dispatchEvent(new Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 500));
return { before, after: R(pick), empty: !!g('.mp-empty') };
