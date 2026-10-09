// Blank-row + focus-visible + accessible-name probe.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mp = document.querySelector('.model-pick');
if (mp) mp.scrollIntoView({ block: 'center' });
await wait(300);

const cells = [...document.querySelectorAll('.mp-cell')];
const grid = document.querySelector('.mp-grid');

const rows = cells.map((c, i) => {
  const nameEl = c.querySelector('.mp-name');
  const b = c.getBoundingClientRect();
  return {
    i,
    hasNameEl: !!nameEl,
    nameText: nameEl ? nameEl.textContent : '<no span>',
    nameLen: nameEl ? nameEl.textContent.length : -1,
    textContent: c.textContent,
    ariaSelected: c.getAttribute('aria-selected'),
    ariaLabel: c.getAttribute('aria-label'),
    title: c.getAttribute('title'),
    w: Math.round(b.width),
    h: Math.round(b.height),
    tabIndex: c.tabIndex,
    bg: getComputedStyle(c).backgroundColor,
  };
});

// focus-visible state for a candidate button after each focus method
const c0 = cells[0];
c0.focus();
await wait(50);
const afterProgrammatic = { matchesFocus: c0.matches(':focus'), matchesFocusVisible: c0.matches(':focus-visible') };
const csAfter = getComputedStyle(c0);

// does the global :focus-visible rule apply to buttons at all? inspect the rule's reach
const rules = [...document.styleSheets].flatMap((s) => {
  try { return [...s.cssRules]; } catch { return []; }
});
const focusSelectors = rules.filter((r) => r.selectorText && /focus/.test(r.selectorText)).map((r) => r.selectorText);

// accessible name of each row as the a11y tree would compute it (text content)
const accNames = cells.map((c) => (c.textContent || '').trim() || '<EMPTY>');

// clicking an empty row
const emptyCell = cells.find((c) => !(c.textContent || '').trim());
let emptyClickResult = null;
if (emptyCell) {
  emptyCell.click();
  await wait(150);
  const input = document.querySelector('#o-model');
  const runBtn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('开始生成'));
  emptyClickResult = {
    inputValueAfter: JSON.stringify(input.value),
    rowsAfter: document.querySelectorAll('.mp-cell').length,
    runDisabledAfter: runBtn ? runBtn.disabled : null,
    runTitleAfter: runBtn ? runBtn.getAttribute('title') : null,
  };
}

return {
  rowCount: cells.length,
  rows,
  accNames,
  emptyRowCount: accNames.filter((n) => n === '<EMPTY>').length,
  afterProgrammatic,
  computedOutlineAfterFocus: csAfter.outlineWidth + ' ' + csAfter.outlineStyle + ' ' + csAfter.outlineColor,
  focusSelectors,
  emptyClickResult,
  gridScroll: grid ? { clientH: grid.clientHeight, scrollH: grid.scrollHeight, canScroll: grid.scrollHeight > grid.clientHeight } : null,
};
