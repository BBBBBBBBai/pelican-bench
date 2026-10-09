// Tab order + empty-state/listbox ARIA + text contrast for the picker's supporting copy.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mp = document.querySelector('.model-pick');
if (mp) mp.scrollIntoView({ block: 'center' });
await wait(300);

const lum = (c) => {
  const m = (c || '').match(/\d+(\.\d+)?/g);
  if (!m) return null;
  const [r, g, b] = m.slice(0, 3).map(Number).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (fg, bg) => {
  const a = lum(fg), b = lum(bg);
  if (a == null || b == null) return null;
  const [x, y] = [a, b].sort((p, q) => q - p);
  return +((x + 0.05) / (y + 0.05)).toFixed(2);
};

// 1. Tab order: compute the DOM-order tabbable sequence and find the index of #o-model and the run button
const isTabbable = (el) => {
  if (el.disabled) return false;
  if (el.tabIndex < 0) return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  const b = el.getBoundingClientRect();
  return b.width > 0 && b.height > 0;
};
const all = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter(isTabbable);
const idxInput = all.indexOf(document.querySelector('#o-model'));
const runBtn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('生成'));
const idxRun = all.indexOf(runBtn);
const between = all.slice(idxInput + 1, idxRun).map((e) => (e.className || e.tagName) + '|' + (e.textContent || '').trim().slice(0, 18));

// 2. listbox children roles when empty
const setVal = (v) => {
  const input = document.querySelector('#o-model');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, v);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
setVal('zzz');
await wait(150);
const grid = document.querySelector('.mp-grid');
const emptyChildren = grid ? [...grid.children].map((c) => ({ tag: c.tagName.toLowerCase(), role: c.getAttribute('role'), cls: c.className, text: (c.textContent || '').slice(0, 20) })) : null;
const emptyEl = document.querySelector('.mp-empty');
const emptyStyle = emptyEl ? getComputedStyle(emptyEl) : null;
const emptyContrast = emptyStyle ? ratio(emptyStyle.color, 'rgb(45,44,40)') : null;

// 3. hint + label contrast
setVal('');
await wait(150);
const note = document.querySelector('.model-pick')?.parentElement?.querySelector('.note');
const label = document.querySelector('label[for="o-model"]');
const panelBg = (() => {
  let el = document.querySelector('.model-pick');
  while (el) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)') return bg;
    el = el.parentElement;
  }
  return null;
})();
const pick = (el) => {
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { color: cs.color, fs: cs.fontSize, fw: cs.fontWeight, ratioVsPanel: ratio(cs.color, panelBg) };
};

// 4. aria relations on the input
const input = document.querySelector('#o-model');
const aria = [...input.attributes].filter((a) => a.name.startsWith('aria')).map((a) => a.name + '=' + a.value);
const inputMisc = {
  role: input.getAttribute('role'),
  ariaExpanded: input.getAttribute('aria-expanded'),
  ariaControls: input.getAttribute('aria-controls'),
  ariaAutocomplete: input.getAttribute('aria-autocomplete'),
  type: input.getAttribute('type'),
  autocomplete: input.getAttribute('autocomplete'),
  spellcheck: input.getAttribute('spellcheck'),
  liveRegions: document.querySelectorAll('[aria-live]').length,
  liveInPicker: document.querySelector('.model-pick [aria-live]') ? 'present' : 'absent',
};

// 5. mobile: does the rail scroll horizontally?
return {
  tabSequence: { inputIndex: idxInput, runIndex: idxRun, tabStopsBetween: between.length, between },
  emptyListboxChildren: emptyChildren,
  emptyContrast: { color: emptyStyle?.color, bg: 'rgb(45,44,40) (--engrave, grid bg)', ratio: emptyContrast },
  panelBg,
  label: pick(label),
  note: pick(note),
  inputMisc,
  aria,
  allCellTabIndexes: [...document.querySelectorAll('.mp-cell')].map((c) => c.tabIndex),
  docScrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
};
