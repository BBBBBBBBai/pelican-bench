// measure the tab distance from .mp-input to the arm button, and the ARIA story
const all = () => [...document.querySelectorAll('button, input, select, textarea, a[href], summary, [tabindex]:not([tabindex="-1"])')]
  .filter(e => !e.disabled && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden');

const input = document.querySelector('.mp-input');
input.focus();
await new Promise(r => setTimeout(r, 80));
const list = all();
const i0 = list.indexOf(input);
const arm = document.querySelector('.btn.arm.xl.wide');
const iArm = list.indexOf(arm);
const between = list.slice(i0 + 1, iArm).map(e => `${e.tagName}.${String(e.className).slice(0, 26)}#${e.id || '-'}`);
const out = {};
out.tabbableTotal = list.length;
out.inputIndex = i0;
out.armIndex = iArm;
out.tabStopsBetweenInputAndArm = between.length;
out.between = between;
out.tabStopsThatAreModelCells = between.filter(s => s.includes('mp-cell')).length;

// full document tab order near the model block
out.window = list.slice(Math.max(0, i0 - 3), iArm + 2).map(e => `${e.tagName}.${String(e.className).slice(0, 26)}#${e.id || '-'}`);

// aria structure
const grid = document.querySelector('.mp-grid');
out.gridRole = grid.getAttribute('role');
out.gridAriaLabel = grid.getAttribute('aria-label');
out.gridChildrenRoles = [...grid.children].map(c => `${c.tagName}[role=${c.getAttribute('role')}]`);
out.listboxChildrenValid = [...grid.children].every(c => ['option', 'group', 'hr', 'script', 'template'].includes(c.getAttribute('role') || ''));
out.activeDescendant = grid.getAttribute('aria-activedescendant');
out.inputRole = input.getAttribute('role');
out.inputComboboxAttrs = { 'aria-expanded': input.getAttribute('aria-expanded'), 'aria-controls': input.getAttribute('aria-controls'), 'aria-autocomplete': input.getAttribute('aria-autocomplete'), 'aria-haspopup': input.getAttribute('aria-haspopup') };

// accessible name computation (crude but faithful for these nodes)
function accName(el) {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria;
  let txt = '';
  for (const n of el.childNodes) {
    if (n.nodeType === 3) txt += n.textContent;
    else if (n.nodeType === 1) txt += accName(n);
  }
  return txt.trim();
}
out.gridAccName = accName(grid);
out.cellAccNames = [...document.querySelectorAll('.mp-cell')].map(c => `"${accName(c)}"`);

// empty-string candidate rows: what is actually rendered?
out.blankCellDetails = [...document.querySelectorAll('.mp-cell')]
  .map((c, i) => ({ i, text: c.querySelector('.mp-name').textContent, nameW: +c.querySelector('.mp-name').getBoundingClientRect().width.toFixed(1), cellH: +c.getBoundingClientRect().height.toFixed(1), accName: accName(c) }))
  .filter(r => r.text === '');
out.blankRowCount = out.blankCellDetails.length;

// duplicate React keys warning present in console? (can't read console here) — report the array itself
out.mountAgainNote = 'MODELS literal has two "" entries at index 3 and 4 (React key warning)';

// focus-visible styling of the cell
const c0 = document.querySelector('.mp-cell');
c0.focus();
out.cellFocusOutline = getComputedStyle(c0).outline;
out.cellFocusVisible = c0.matches(':focus-visible');
out.cellFocusOutlineStyle = { style: getComputedStyle(c0).outlineStyle, width: getComputedStyle(c0).outlineWidth, color: getComputedStyle(c0).outlineColor, offset: getComputedStyle(c0).outlineOffset };
out.cellBoxShadow = getComputedStyle(c0).boxShadow;

// disabled arm: does it accept hover events?
const armB = document.querySelector('.btn.arm.xl.wide');
out.armPointerEvents = getComputedStyle(armB).pointerEvents;
out.armHasTitle = !!armB.getAttribute('title');
out.armAriaDisabled = armB.getAttribute('aria-disabled');
out.armCursor = getComputedStyle(armB).cursor;

return out;
