const out = {};
const g = (s) => document.querySelector(s);
const ga = (s) => [...document.querySelectorAll(s)];
const R = (el) => { const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
const rail = document.querySelector('.rack-scroll, .panel-scroll') || document.scrollingElement;
g('.model-pick').scrollIntoView({ block: 'center' });
await new Promise(r => setTimeout(r, 400));
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
const set = async (v) => { setter.call(g('.mp-input'), v); g('.mp-input').dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 320)); };

const snap = (label) => ({
  label,
  input: R(g('.mp-input')),
  grid: R(g('.mp-grid')),
  gridScrollH: g('.mp-grid').scrollHeight,
  visibleRows: ga('.mp-cell').length,
  rowsFullyVisible: ga('.mp-cell').filter(c => { const b = c.getBoundingClientRect(), gb = g('.mp-grid').getBoundingClientRect(); return b.top >= gb.top - 0.5 && b.bottom <= gb.bottom + 0.5; }).length,
  arm: R(g('.btn.arm.xl.wide')),
  armY: +g('.btn.arm.xl.wide').getBoundingClientRect().y.toFixed(1),
  hintY: (() => { const n = [...document.querySelectorAll('.field .note')].find(x => /先定一个模型名/.test(x.textContent)); return n ? +n.getBoundingClientRect().y.toFixed(1) : null; })(),
  railScrollTop: rail.scrollTop,
});

out.empty = await snap('empty input (initial)');
await set('zzz');
out.noHit = await snap('typed zzz (no hit)');
await set('');
ga('.mp-cell')[4].click();
await new Promise(r => setTimeout(r, 350));
out.picked = await snap('picked a candidate');
// what does the user need to do to pick a DIFFERENT one?
out.toSwitch = { escapeDoesNothingAlreadyVerified: true, needs: 'Ctrl+A then Delete then retype/click; there is no clear affordance' };
return out;
