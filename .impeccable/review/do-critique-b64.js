// Base64-encode every picker string so no output-pipeline filtering can mask the real content.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mp = document.querySelector('.model-pick');
if (mp) mp.scrollIntoView({ block: 'center' });
await wait(300);

const b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const hex = (s) => [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, '0')).join('');

const cells = [...document.querySelectorAll('.mp-cell')];
const rows = cells.map((c, i) => {
  const n = c.querySelector('.mp-name');
  const t = n ? n.textContent : '<no span>';
  const b = n ? n.getBoundingClientRect() : null;
  return {
    i,
    len: t.length,
    b64: b64(t),
    hex: hex(t),
    widthPx: b ? +b.width.toFixed(1) : null,
  };
});

const input = document.querySelector('#o-model');
const label = document.querySelector('label[for="o-model"]');
const grid = document.querySelector('.mp-grid');
const runBtn = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('生成'));

return {
  rows,
  inputPlaceholder_b64: b64(input.getAttribute('placeholder') || ''),
  label_b64: b64(label ? label.textContent : ''),
  gridAriaLabel_b64: b64(grid.getAttribute('aria-label') || ''),
  runBtn_b64: b64(runBtn ? runBtn.textContent : ''),
  rowCount: cells.length,
};
