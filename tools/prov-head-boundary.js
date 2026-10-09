// 粘住的供应商标题行在各档宽度上的边界行为。
// 要回答的是：>900px 它必须是**普通块**（宽屏右栏自己有滚动区，粘反而多余）；
// ≤900px 它必须粘，而且左右要贴齐 `.bay-section` 的边（负外边距有没有吃对）。
// 另外量一下标题行自己一条刻线（下边）在不在，以及那一节的总高有没有变。
//
// 用法：node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --width=<w> --height=<h> [--mobile --touch] --do=tools/prov-head-boundary.js
const R = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    x: +r.x.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
    pos: cs.position, top: cs.top, z: cs.zIndex,
    borderBottom: cs.borderBottomWidth + ' ' + cs.borderBottomColor,
    bg: cs.backgroundColor,
  };
};
const head = document.querySelector('.prov-head');
const sec = document.querySelector('.bay-section');
const sr = sec.getBoundingClientRect();
const cs = getComputedStyle(sec);
const hl = getComputedStyle(sec).paddingLeft;
return {
  viewport: { w: window.innerWidth, h: window.innerHeight },
  head: R(head),
  section: {
    x: +sr.x.toFixed(1), w: +sr.width.toFixed(1), h: +sr.height.toFixed(1),
    padLeft: cs.paddingLeft, padRight: cs.paddingRight, padBottom: cs.paddingBottom,
    sectionPadVar: cs.getPropertyValue('--section-pad').trim(),
  },
  bar: R(document.querySelector('.bay-head')),
  // 标题行左右两边是不是盖到内边距之外（粘住时要盖满，宽屏时不该伸出去）
  flush: {
    leftGap: +(head.getBoundingClientRect().left - sr.left).toFixed(1),
    rightGap: +(sr.right - head.getBoundingClientRect().right).toFixed(1),
  },
  scrollContainers: [...document.querySelectorAll('.panel, .panel-scroll, .rack-scroll')].map((el) => {
    const c2 = getComputedStyle(el);
    return { cls: el.className, overflowY: c2.overflowY, client: el.clientHeight, scroll: el.scrollHeight };
  }),
  receipt: R(document.querySelector('.prov-receipt')),
  note: document.querySelector('.prov-receipt-note') ? R(document.querySelector('.prov-receipt-note')) : null,
};
