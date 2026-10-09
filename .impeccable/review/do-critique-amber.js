// Mobile + one-light-rule evidence: count simultaneous amber areas in the viewport.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mp = document.querySelector('.model-pick');
if (mp) mp.scrollIntoView({ block: 'center' });
await wait(400);

const isAmber = (c) => {
  const m = (c || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return false;
  const [r, g, b, a] = [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  if (a < 0.5) return false;
  return r > 180 && g > 100 && g < 200 && b < 90;
};

// select a model first
const cells = [...document.querySelectorAll('.mp-cell')];
const c = cells.find((x) => x.querySelector('.mp-name')?.textContent === 'deepseek-v3.2-reasoner-preview') || cells[5];
c.click();
await wait(200);

const amber = [];
document.querySelectorAll('*').forEach((el) => {
  const cs = getComputedStyle(el);
  const b = el.getBoundingClientRect();
  if (b.width < 1 || b.height < 1) return;
  if (b.bottom < 0 || b.top > innerHeight) return;
  if (isAmber(cs.backgroundColor)) amber.push({ sel: el.className || el.tagName, kind: 'bg', area: Math.round(b.width * b.height), color: cs.backgroundColor, text: (el.textContent || '').slice(0, 24) });
  if (isAmber(cs.color) && (el.textContent || '').trim() && el.children.length === 0) amber.push({ sel: el.className || el.tagName, kind: 'text-color', area: Math.round(b.width * b.height), color: cs.color, text: (el.textContent || '').slice(0, 24) });
  if (isAmber(cs.borderColor) && parseFloat(cs.borderTopWidth) > 0) amber.push({ sel: el.className || el.tagName, kind: 'border', area: Math.round(b.width * b.height), color: cs.borderColor, text: (el.textContent || '').slice(0, 24) });
});

const largeAmber = amber.filter((a) => a.area > 400);
const seen = new Set();
const dedup = amber.filter((a) => {
  const k = a.sel + '|' + a.kind + '|' + a.text;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

return {
  viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
  pickerBox: (() => { const b = mp.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom) }; })(),
  amberTotal: amber.length,
  amberLarge: largeAmber.length,
  amberSamples: dedup.slice(0, 40),
  selectedCellColor: getComputedStyle(c).color,
};
