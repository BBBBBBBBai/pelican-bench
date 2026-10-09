// Verify the blank rows and the focus-visible behaviour with real keyboard Tab.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mp = document.querySelector('.model-pick');
if (mp) mp.scrollIntoView({ block: 'center' });
await wait(300);

const cells = [...document.querySelectorAll('.mp-cell')];
const rows = cells.map((c, i) => {
  const nameEl = c.querySelector('.mp-name');
  const b = c.getBoundingClientRect();
  return {
    i,
    hasNameEl: !!nameEl,
    nameText: nameEl ? JSON.stringify(nameEl.textContent) : null,
    childCount: c.children.length,
    innerHTML: c.innerHTML,
    h: Math.round(b.height),
    w: Math.round(b.width),
    textLen: (c.textContent || '').length,
  };
});

// aria/name of each row
const accName = cells.map((c) => (c.textContent || '').trim());

// real keyboard focus: Tab from the model input
const input = document.querySelector('#o-model');
input.focus();
await wait(80);
const focusSeq = [];
for (let k = 0; k < 14; k += 1) {
  // dispatch a real Tab via CDP-free fallback: move focus with the browser's own order is not scriptable,
  // so emulate by reading tabIndex order instead
  focusSeq.push(document.activeElement?.id || document.activeElement?.tagName);
  break;
}

// which element does .focus() actually ring? check the CSS rule sources for focus-visible
const sheets = [...document.styleSheets].flatMap((s) => {
  try {
    return [...s.cssRules];
  } catch {
    return [];
  }
});
const focusRules = sheets
  .filter((r) => r.selectorText && /focus/.test(r.selectorText))
  .map((r) => r.selectorText + ' { ' + r.style.cssText + ' }');

const cellFocusVisible = (() => {
  const c = cells[5];
  c.focus();
  return { matches: c.matches(':focus-visible'), matchesFocus: c.matches(':focus') };
})();
const inputFocusVisible = (() => {
  input.focus();
  return { matches: input.matches(':focus-visible'), matchesFocus: input.matches(':focus') };
})();

return {
  rows,
  accName,
  focusSeq,
  focusRules,
  cellFocusVisible,
  inputFocusVisible,
  emptyButtonCount: cells.filter((c) => !(c.textContent || '').trim()).length,
  totalCells: cells.length,
};
