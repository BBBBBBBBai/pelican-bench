// DOM-simulation probe for .model-pick / #mp-grid geometry.
// Measures the real rendered state, then trims/clones .mp-cell nodes to N
// and re-measures. Valid for CSS geometry because .mp-grid height is a fixed
// constant (block-size: 220px) that does not depend on children.
const px = (v) => Math.round(v * 100) / 100;
const rect = (el) => {
  const r = el.getBoundingClientRect();
  return { top: px(r.top), bottom: px(r.bottom), height: px(r.height), left: px(r.left), width: px(r.width) };
};

const grid = document.querySelector('#mp-grid');
const well = document.querySelector('.mp-well');
const arm = document.querySelector('.arm');
if (!grid) return { error: 'no #mp-grid found', url: location.href };

const cs = getComputedStyle(grid);

const cellsAll = () => [...document.querySelectorAll('#mp-grid .mp-cell')];

const snap = (label) => {
  const cells = cellsAll();
  const last = cells[cells.length - 1] ?? null;
  const g = grid.getBoundingClientRect();
  return {
    label,
    count: cells.length,
    gridRect: rect(grid),
    gridClientH: grid.clientHeight,
    gridScrollH: grid.scrollHeight,
    gridOffsetH: grid.offsetHeight,
    computedBlockSize: cs.blockSize,
    computedHeight: cs.height,
    computedAlignContent: cs.alignContent,
    computedGridAutoRows: cs.gridAutoRows,
    computedBg: cs.backgroundColor,
    borderTop: cs.borderTopWidth,
    borderBottom: cs.borderBottomWidth,
    cellH: cells.length ? px(cells[0].getBoundingClientRect().height) : null,
    cellPadding: cells.length ? getComputedStyle(cells[0]).padding : null,
    cellLineHeight: cells.length ? getComputedStyle(cells[0]).lineHeight : null,
    lastCellBottom: last ? px(last.getBoundingClientRect().bottom) : null,
    gridBottom: px(g.bottom),
    emptyBandPx: last ? px(g.bottom - last.getBoundingClientRect().bottom) : null,
    wellRect: well ? rect(well) : null,
    armTop: arm ? px(arm.getBoundingClientRect().top) : null,
    armBottom: arm ? px(arm.getBoundingClientRect().bottom) : null,
    hintTop: (() => { const h = document.querySelector('#o-model-hint'); return h ? px(h.getBoundingClientRect().top) : null; })(),
  };
};

const results = [];
results.push(snap('real-config'));

const orig = cellsAll().map((c) => c.cloneNode(true));
const parent = grid;
for (const n of [1, 2, 3, 7, 10]) {
  cellsAll().forEach((c) => c.remove());
  for (let i = 0; i < n; i += 1) {
    const clone = orig[i % orig.length].cloneNode(true);
    clone.id = 'mp-opt-' + i;
    parent.appendChild(clone);
  }
  results.push(snap('domsim-' + n));
}

// restore original nodes so the page is left as found
cellsAll().forEach((c) => c.remove());
orig.forEach((c) => parent.appendChild(c));
results.push(snap('restored'));

// park the picker mid-viewport for the screenshot
document.querySelector('.model-pick')?.scrollIntoView({ block: 'center' });
await new Promise((r) => setTimeout(r, 500));

return { url: location.href, viewport: { w: innerWidth, h: innerHeight }, results };
