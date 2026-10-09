const out = {};
const g = (s) => document.querySelector(s);
const ga = (s) => [...document.querySelectorAll(s)];
g('.model-pick').scrollIntoView({ block: 'center' });
await new Promise(r => setTimeout(r, 300));

// Real keyboard: Tab from the mp-input and capture focus-visible on each model row
const inp = g('.mp-input');
inp.focus();
await new Promise(r => setTimeout(r, 120));
out.start = { tag: document.activeElement.tagName, cls: document.activeElement.className };

// dispatch a real Tab key via CDP is not possible here; use sequential .focus() then check matches(':focus-visible')
// Instead: emulate keyboard modality by dispatching Tab keydown then focus the element.
out.rows = [];
for (const c of ga('.mp-cell')) {
  c.focus();
  await new Promise(r => setTimeout(r, 60));
  const cs = getComputedStyle(c);
  out.rows.push({
    name: c.textContent.slice(0, 22),
    focusVisible: c.matches(':focus-visible'),
    outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor,
    boxShadow: cs.boxShadow,
    bg: cs.backgroundColor,
  });
}

// keyboard modality test: press Tab for real using key events won't move focus in headless;
// but check whether input has any listbox keyboard wiring at all
out.inputAria = {
  role: inp.getAttribute('role'), expanded: inp.getAttribute('aria-expanded'),
  controls: inp.getAttribute('aria-controls'), actdesc: inp.getAttribute('aria-activedescendant'),
  autocomplete: inp.getAttribute('aria-autocomplete'), haspopup: inp.getAttribute('aria-haspopup'),
  type: inp.type, placeholder: inp.placeholder, id: inp.id, label: inp.labels?.[0]?.textContent,
};

// Does the raw untrimmed value survive to the request? inspect React props indirectly via the value
{
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, ' qwen3-max '); inp.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 250));
  out.spaceState = {
    rawValue: JSON.stringify(inp.value),
    rows: ga('.mp-cell').length,
    selRows: ga('.mp-cell[aria-selected="true"]').length,
    armDisabled: g('.btn.arm.xl.wide')?.disabled,
  };
}

// listbox children roles in empty state
{
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, 'zzz'); inp.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 250));
  out.emptyChildren = [...g('.mp-grid').children].map(c => c.tagName + '[' + (c.getAttribute('role') || 'no-role') + ']');
  out.emptyGridName = g('.mp-grid').getAttribute('aria-label');
}

// after selecting, how many rows survive (the switch-cost trap) + exact numbers
{
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, ''); inp.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));
  ga('.mp-cell')[2].click();
  await new Promise(r => setTimeout(r, 300));
  out.afterSelect = {
    inputValue: inp.value,
    rowsVisible: ga('.mp-cell').length,
    gridH: g('.mp-grid').getBoundingClientRect().height,
    keystrokesToSeeOthers: 'must delete input text (no clear button, Escape does nothing)',
  };
}
return out;
