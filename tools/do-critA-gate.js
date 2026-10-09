const out = {};
const g = (s) => document.querySelector(s);
const ga = (s) => [...document.querySelectorAll(s)];
g('.model-pick').scrollIntoView({ block: 'center' });
await new Promise(r => setTimeout(r, 300));

const arm = g('.btn.arm.xl.wide');
const R = (el) => { const r = el.getBoundingClientRect(); return [+r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)]; };

// state 1: nothing selected -> gate disabled
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(g('.mp-input'), ''); g('.mp-input').dispatchEvent(new Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
{
  const cs = getComputedStyle(arm);
  out.disabledGate = {
    disabled: arm.disabled, title: arm.getAttribute('title'), rect: R(arm),
    color: cs.color, borderColor: cs.borderTopColor, boxShadow: cs.boxShadow,
    cursor: cs.cursor, opacity: cs.opacity,
    matchesNotDisabled: arm.matches(':not(:disabled)'),
  };
}

// does a disabled button receive pointer events at all (i.e. can `title` ever surface)?
{
  let fired = { mouseover: 0, click: 0, mousemove: 0 };
  const onOver = () => { fired.mouseover += 1; };
  const onClick = () => { fired.click += 1; };
  arm.addEventListener('mouseover', onOver);
  arm.addEventListener('click', onClick);
  const r = arm.getBoundingClientRect();
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  for (const type of ['mouseover', 'mousemove', 'click']) {
    arm.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: cx, clientY: cy }));
  }
  out.syntheticEventsOnDisabled = { ...fired };
  arm.removeEventListener('mouseover', onOver);
  arm.removeEventListener('click', onClick);
  out.disabledFormControlGetsHit = document.elementFromPoint(cx, cy) === arm || arm.contains(document.elementFromPoint(cx, cy));
}

// state 2: selected -> gate enabled, compare colour
setter.call(g('.mp-input'), 'qwen3-max'); g('.mp-input').dispatchEvent(new Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
{
  const cs = getComputedStyle(arm);
  out.enabledGate = { disabled: arm.disabled, title: arm.getAttribute('title'), color: cs.color, borderColor: cs.borderTopColor, boxShadow: cs.boxShadow };
}

// how loud is the amber gate relative to the rest of the panel: count saturated-amber text nodes on screen
{
  const amber = 'rgb(240, 160, 32)';
  const loud = [...document.querySelectorAll('body *')].filter(el => !el.children.length && el.textContent.trim() && getComputedStyle(el).color === amber);
  out.amberTextNodes = loud.map(el => ({ cls: String(el.className).slice(0, 30), text: el.textContent.trim().slice(0, 20) }));
  out.amberCount = loud.length;
}

// is the gate area the only chrome that changes when the model is picked?
out.gatePositionRelativeToPicker = {
  gridBottom: R(g('.mp-grid'))[1] + R(g('.mp-grid'))[3],
  armTop: R(arm)[1],
  noteText: g('.model-pick .note')?.textContent,
};
return out;
