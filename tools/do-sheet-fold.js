// --do 文件：edge-cdp.mjs 会再包一层 async。打开标本页并展开 SVG 源码抽屉。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cell = [...document.querySelectorAll('.ch')].find((b) => b.querySelector('.ch-plate img'));
if (!cell) return { error: 'no cell with image' };
cell.click();
await sleep(1800);
const f = document.querySelector('.sheet .fold');
if (!f) return { error: 'no sheet fold' };
f.open = true;
await sleep(800);
f.scrollIntoView({ block: 'center' });
await sleep(400);
return {
  label: f.querySelector('summary')?.textContent?.trim(),
  open: f.open,
  h: Math.round(f.getBoundingClientRect().height * 10) / 10,
  contentCS: getComputedStyle(f, '::details-content').contentVisibility,
  docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
};
