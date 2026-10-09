// Does the keyboard focus ring on a .mp-cell survive the scroll container's clipping?
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mp = document.querySelector('.model-pick');
if (mp) mp.scrollIntoView({ block: 'center' });
await wait(400);

// Simulate the browser's :focus-visible styling exactly as styles.css declares it for
// buttons that are NOT input/select/textarea (global rule at styles.css:163).
const style = document.createElement('style');
style.id = 'sim-focus-visible';
style.textContent = '.mp-cell.sim-fv { outline: 2px solid #f0a020 !important; outline-offset: 2px !important; }';
document.head.appendChild(style);

const grid = document.querySelector('.mp-grid');
const cells = [...document.querySelectorAll('.mp-cell')];
const gb = grid.getBoundingClientRect();

// mark the 3rd row (interior, away from edges) as if keyboard-focused
cells[2].classList.add('sim-fv');
await wait(200);

const cb = cells[2].getBoundingClientRect();
const ring = { left: cb.left - 2, right: cb.right + 2, top: cb.top - 2, bottom: cb.bottom + 2 };

// overflow behaviour of the grid
const gcs = getComputedStyle(grid);
const gridInfo = {
  overflowX: gcs.overflowX,
  overflowY: gcs.overflowY,
  border: gcs.border,
  box: { left: Math.round(gb.left), right: Math.round(gb.right), top: Math.round(gb.top), bottom: Math.round(gb.bottom) },
};
const ringInfo = {
  left: Math.round(ring.left),
  right: Math.round(ring.right),
  top: Math.round(ring.top),
  bottom: Math.round(ring.bottom),
};
const clipped = {
  left: ring.left < gb.left,
  right: ring.right > gb.right,
  top: ring.top < gb.top,
  bottom: ring.bottom > gb.bottom,
};

// Also: what is directly behind the ring on the left/right (the grid's own padding area)?
const probe = (x, y) => {
  const el = document.elementFromPoint(x, y);
  return el ? el.className || el.tagName : null;
};
const backdrop = {
  leftOfRing: probe(Math.max(0, ring.left - 1), (ring.top + ring.bottom) / 2),
  rightOfRing: probe(Math.min(innerWidth - 1, ring.right + 1), (ring.top + ring.bottom) / 2),
  aboveRing: probe((ring.left + ring.right) / 2, Math.max(0, ring.top - 1)),
  belowRing: probe((ring.left + ring.right) / 2, Math.min(innerHeight - 1, ring.bottom + 1)),
};

// vertical neighbours: does the ring overlap the 1px gap and the neighbouring wells?
const prev = cells[1].getBoundingClientRect();
const next = cells[3].getBoundingClientRect();
const overlap = {
  gapPx: Math.round(cb.top - prev.bottom),
  ringIntrudesIntoPrev: Math.round(prev.bottom - ring.top),
  ringIntrudesIntoNext: Math.round(ring.bottom - next.top),
};

return { gridInfo, ringInfo, clipped, backdrop, overlap, cellBox: { h: Math.round(cb.height), w: Math.round(cb.width) } };
