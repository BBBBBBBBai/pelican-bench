// Scroll the Model Under Test picker into view and report geometry facts.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const mp = document.querySelector('.model-pick');
if (mp) mp.scrollIntoView({ block: 'center' });

// let lazy layout settle
await wait(400);

const r = (el) => {
  if (!el) return null;
  const b = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    w: Math.round(b.width),
    h: Math.round(b.height),
    top: Math.round(b.top),
    font: cs.fontSize,
    color: cs.color,
    bg: cs.backgroundColor,
    outline: cs.outlineWidth + ' ' + cs.outlineStyle + ' ' + cs.outlineColor,
    radius: cs.borderRadius,
  };
};

const grid = document.querySelector('.mp-grid');
const input = document.querySelector('#o-model');
const cells = [...document.querySelectorAll('.mp-cell')];
const dots = [...document.querySelectorAll('.mp-dot')];

return {
  viewport: { w: innerWidth, h: innerHeight },
  input: r(input),
  grid: grid ? { ...r(grid), scrollHeight: grid.scrollHeight, clientHeight: grid.clientHeight, role: grid.getAttribute('role'), label: grid.getAttribute('aria-label') } : null,
  cellCount: cells.length,
  cellHeights: cells.map((c) => Math.round(c.getBoundingClientRect().height)),
  cellNames: cells.map((c) => c.querySelector('.mp-name')?.textContent ?? ''),
  cellAlpha: cells.map((c) => {
    const b = c.getBoundingClientRect();
    const cs = getComputedStyle(c);
    return { h: Math.round(b.height), w: Math.round(b.width), fs: cs.fontSize, color: cs.color, bg: cs.backgroundColor };
  }),
  dot: r(dots[0]),
  emptyEl: r(document.querySelector('.mp-empty')),
  hint: r(document.querySelector('.model-pick .note')),
  labelText: document.querySelector('label[for="o-model"]')?.textContent ?? null,
  inputPlaceholder: input?.getAttribute('placeholder') ?? null,
};
