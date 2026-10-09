// 弹窗打开时，背后那一层还能不能滚。
// 用 `--do=` 调用。
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const before = {
  docScrollH: document.documentElement.scrollHeight,
  docClientH: document.documentElement.clientHeight,
  bodyScrollH: document.body.scrollHeight,
  bodyClientH: document.body.clientHeight,
  bodyOverflowY: getComputedStyle(document.body).overflowY,
  rackScrolls: (() => {
    const r = document.querySelector('.rack-scroll');
    return r ? { h: r.clientHeight, sh: r.scrollHeight, scrolls: r.scrollHeight > r.clientHeight + 1 } : null;
  })(),
  panelScrolls: (() => {
    const p = document.querySelector('.panel-scroll');
    return p ? { h: p.clientHeight, sh: p.scrollHeight, scrolls: p.scrollHeight > p.clientHeight + 1 } : null;
  })(),
  scrollbarGutter: getComputedStyle(document.documentElement).scrollbarGutter,
};

const cell = document.querySelector('.ch:not(.live)');
cell.click();
await wait(1300);

// 试着滚动文档，看它动不动
const y0 = window.scrollY;
window.scrollTo(0, 600);
await wait(120);
const scrolledAfterOpen = window.scrollY !== y0;

return {
  before,
  docScrollsBefore: before.docScrollH > before.docClientH,
  afterOpen: {
    bodyOverflowY: getComputedStyle(document.body).overflowY,
    htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
    windowScrollY: window.scrollY,
    scrolledAfterOpen,
    docScrollH: document.documentElement.scrollHeight,
  },
  rootInert: document.getElementById('root')?.hasAttribute('inert') ?? null,
};
