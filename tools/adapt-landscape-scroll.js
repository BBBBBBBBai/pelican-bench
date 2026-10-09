/* 横屏：整页 scrollHeight 5025（视口 390）——滚下去到底滚的是什么？
   这一档本该「机架有自己的滚动区」，实测 `.rack-scroll` 是否还是滚动容器。 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const px = (v) => Math.round(v * 10) / 10;
const box = (s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { y: px(r.y), h: px(r.height), w: px(r.width) };
};
const chVisible = () =>
  [...document.querySelectorAll('.ch')].filter((c) => {
    const r = c.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  }).length;

const rackScroll = document.querySelector('.rack-scroll');
const cs = getComputedStyle(rackScroll);
const out = {
  at0: {
    scrollY: Math.round(scrollY),
    docScrollH: document.documentElement.scrollHeight,
    bench: box('.bench'),
    busbar: box('.busbar'),
    bay: box('.bay'),
    rail: box('.rail'),
    rackScroll: box('.rack-scroll'),
    panel: box('.panel'),
    rackScrollOverflowY: cs.overflowY,
    rackScrollCanScroll: rackScroll.scrollHeight > rackScroll.clientHeight + 1,
    rackScrollClient: rackScroll.clientHeight,
    rackScrollContent: rackScroll.scrollHeight,
    chVisible: chVisible(),
  },
};
window.scrollTo(0, 900);
await sleep(400);
out.at900 = {
  scrollY: Math.round(scrollY),
  bench: box('.bench'),
  busbar: box('.busbar'),
  rail: box('.rail'),
  panel: box('.panel'),
  chVisible: chVisible(),
  hitMid: (() => {
    const el = document.elementFromPoint(200, 195);
    return el ? el.tagName + '.' + String(el.className).slice(0, 20) : null;
  })(),
};
// 滚回顶部，试着在机架区里用滚动容器滚（有内容的滚法）
window.scrollTo(0, 0);
await sleep(300);
rackScroll.scrollTop = 500;
await sleep(300);
out.afterInnerScroll = { innerTop: Math.round(rackScroll.scrollTop), winY: Math.round(scrollY) };
return out;
