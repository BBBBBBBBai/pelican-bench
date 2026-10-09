const out = {};
const cells = [...document.querySelectorAll('.mp-cell')];
out.n = cells.length;
out.rows = cells.map((c, i) => {
  const nameEl = c.querySelector('.mp-name');
  const dot = c.querySelector('.mp-dot');
  const r = c.getBoundingClientRect();
  return {
    i,
    html: c.innerHTML.slice(0, 90),
    nameText: nameEl ? JSON.stringify(nameEl.textContent) : 'NO .mp-name',
    nameW: nameEl ? +nameEl.getBoundingClientRect().width.toFixed(1) : null,
    dotW: dot ? +dot.getBoundingClientRect().width.toFixed(1) : null,
    cellH: +r.height.toFixed(1),
    cellW: +r.width.toFixed(1),
    bg: getComputedStyle(c).backgroundColor,
    isBlank: !(nameEl && nameEl.textContent.trim()),
  };
});
out.blankIdx = out.rows.filter(r => r.isBlank).map(r => r.i);
out.blankCount = out.blankIdx.length;
out.blankHtmlSamples = out.rows.filter(r => r.isBlank).map(r => r.html);
// do the blank rows respond to click?
const blank = out.rows.find(r => r.isBlank);
if (blank) {
  const el = cells[blank.i];
  el.click();
  await new Promise(r => setTimeout(r, 200));
  out.afterBlankClick = { inputValue: JSON.stringify(document.querySelector('.mp-input').value), ariaSelected: el.getAttribute('aria-selected'), armDisabled: document.querySelector('.btn.arm.xl.wide')?.disabled };
}
return out;
