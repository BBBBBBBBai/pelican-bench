const out = {};
const cells = [...document.querySelectorAll('.mp-cell')];
out.count = cells.length;
out.rows = cells.map((c, i) => {
  const n = c.querySelector('.mp-name');
  const t = n ? n.textContent : null;
  const r = c.getBoundingClientRect();
  const nr = n ? n.getBoundingClientRect() : null;
  return {
    i,
    raw: t,
    len: t === null ? null : t.length,
    codes: t === null ? null : [...t].map(ch => ch.codePointAt(0)),
    trimmed: t === null ? null : t.trim(),
    trimIsEmpty: t === null ? null : (t.trim() === ''),
    strictlyEmpty: t === '',
    nameW: nr ? +nr.width.toFixed(1) : null,
    cellH: +r.height.toFixed(1),
    textAlign: n ? getComputedStyle(n).textAlign : null,
  };
});

// click each "blank-looking" cell to see what it does
let clicked = [];
for (const row of out.rows) {
  if (row.len !== null && row.len <= 1) {
    const el = cells[row.i];
    el.click();
    await new Promise(r => setTimeout(r, 180));
    const inp = document.querySelector('.mp-input');
    clicked.push({ i: row.i, afterClickInput: JSON.stringify(inp.value), ariaSelected: el.getAttribute('aria-selected'), armDisabled: document.querySelector('.btn.arm.xl.wide')?.disabled });
  }
}
out.blankClicks = clicked;

// also: are the two rows visually identical / is one the duplicate key?
out.htmlOfAll = cells.map(c => c.outerHTML.replace(/\s+/g, ' ').slice(0, 100));
return out;
