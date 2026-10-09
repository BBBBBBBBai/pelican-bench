// Reads the REAL rendered state of the model picker, no DOM mutation.
const px = (v) => Math.round(v * 100) / 100;
const rect = (el) => {
  const r = el.getBoundingClientRect();
  return { top: px(r.top), bottom: px(r.bottom), height: px(r.height) };
};
const grid = document.querySelector('#mp-grid');
if (!grid) return { error: 'no #mp-grid', url: location.href };
const well = document.querySelector('.mp-well');
const arm = document.querySelector('.arm');
const cs = getComputedStyle(grid);
const cells = [...document.querySelectorAll('#mp-grid .mp-cell')];
const last = cells[cells.length - 1] ?? null;
const g = grid.getBoundingClientRect();
const cellCs = cells.length ? getComputedStyle(cells[0]) : null;

const out = {
  url: location.href,
  viewport: { w: innerWidth, h: innerHeight },
  candidateNames: cells.map((c) => c.querySelector('.mp-name')?.textContent ?? ''),
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
  computedBorderTop: cs.borderTopWidth,
  computedBorderBottom: cs.borderBottomWidth,
  computedPadding: cs.padding,
  cellH: cells.length ? px(cells[0].getBoundingClientRect().height) : null,
  cellPadding: cellCs ? cellCs.padding : null,
  cellLineHeight: cellCs ? cellCs.lineHeight : null,
  cellFontSize: cellCs ? cellCs.fontSize : null,
  cellBorder: cellCs ? cellCs.border : null,
  lastCellBottom: last ? px(last.getBoundingClientRect().bottom) : null,
  gridBottom: px(g.bottom),
  emptyBandPx: last ? px(g.bottom - last.getBoundingClientRect().bottom) : null,
  wellRect: well ? rect(well) : null,
  armTop: arm ? px(arm.getBoundingClientRect().top) : null,
  armBottom: arm ? px(arm.getBoundingClientRect().bottom) : null,
  armText: arm ? arm.textContent.trim().slice(0, 20) : null,
  hintTop: (() => { const h = document.querySelector('#o-model-hint'); return h ? px(h.getBoundingClientRect().top) : null; })(),
  emptyStatePresent: Boolean(document.querySelector('.mp-empty')),
};
document.querySelector('.model-pick')?.scrollIntoView({ block: 'center' });
await new Promise((r) => setTimeout(r, 500));
out.afterScroll = { gridTop: px(grid.getBoundingClientRect().top), gridBottom: px(grid.getBoundingClientRect().bottom) };
return out;
