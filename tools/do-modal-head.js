// 弹窗头部在窄屏为什么撑到 434px。
// 用 `--do=` 调用。
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const cell = document.querySelector('.ch:not(.live)');
if (!cell) return { error: 'no cell' };
cell.click();
await wait(1300);

const sheet = document.querySelector('.sheet');
const head = document.querySelector('.sheet-head');
if (!sheet || !head) return { error: 'no sheet' };

const info = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    cls: (el.className || el.tagName).toString().slice(0, 30),
    text: (el.textContent || '').trim().slice(0, 26),
    x: Math.round(r.x),
    w: Math.round(r.width),
    scrollW: el.scrollWidth,
    clientW: el.clientWidth,
    minW: cs.minWidth,
    flex: cs.flex,
    ws: cs.whiteSpace,
    overflowX: cs.overflowX,
    // 该元素自己的「最小内容宽度」—— flex 收缩绕不过它
    minContent: (() => {
      const old = el.style.width;
      el.style.width = 'min-content';
      const w = Math.round(el.getBoundingClientRect().width);
      el.style.width = old;
      return w;
    })(),
  };
};

const headKids = [...head.children].map(info);
const body = document.querySelector('.sheet-body');
const bodyKids = body ? [...body.children].map(info) : null;

return {
  viewport: { w: innerWidth, h: innerHeight },
  sheet: info(sheet),
  head: info(head),
  headKids,
  body: info(body),
  bodyKids,
  headWrap: getComputedStyle(head).flexWrap,
  // 头部最小内容宽度合计
  headMinTotal: headKids.reduce((s, k) => s + (k?.minContent ?? 0), 0),
};
