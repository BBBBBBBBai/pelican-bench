// --do 文件：edge-cdp.mjs 会再包一层 async，所以这里直接写语句，不要自带 wrapper。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const f = document.querySelector('.fold');
if (!f) return { error: 'no .fold' };
f.scrollIntoView({ block: 'center' });
await sleep(400);
const g = () => ({
  open: f.open,
  foldH: Math.round(f.getBoundingClientRect().height * 10) / 10,
  contentCS: getComputedStyle(f, '::details-content').contentVisibility,
  chevron: getComputedStyle(f.querySelector('summary'), '::before').transform,
});

f.open = false;
await sleep(600);
const closed = g();

f.open = true;
await sleep(900);
const open = g();

f.scrollIntoView({ block: 'center' });
await sleep(400);
return {
  closed,
  open,
  docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
};
