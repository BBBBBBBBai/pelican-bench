// --do 文件：edge-cdp.mjs 会再包一层 async，所以这里直接写语句，不要自带 wrapper。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const f = document.querySelector('.fold');
if (!f) return { error: 'no .fold' };
f.open = false;
await sleep(700);
f.scrollIntoView({ block: 'center' });
await sleep(400);
return {
  open: f.open,
  foldH: Math.round(f.getBoundingClientRect().height * 10) / 10,
  contentCS: getComputedStyle(f, '::details-content').contentVisibility,
  docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
};
