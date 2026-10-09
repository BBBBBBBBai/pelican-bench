/* 减少动态效果打开后，横杆的展开还剩什么？要求：直接跳变，不留过渡。 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (s) => document.querySelector(s);
const px = (v) => Math.round(v * 10) / 10;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const full = q('.rail-full');
const cs = getComputedStyle(full);
const before = {
  reduce,
  railH: px(q('.rail').getBoundingClientRect().height),
  transition: cs.transitionProperty + ' / ' + cs.transitionDuration,
  visibility: cs.visibility,
  blockSize: cs.blockSize,
};
q('.rail-toggle').click();
await sleep(40); // 远小于 260ms：如果还有过渡，这时的高度应该在中间
const midH = px(full.getBoundingClientRect().height);
await sleep(600);
const after = {
  railH: px(q('.rail').getBoundingClientRect().height),
  fullH: px(full.getBoundingClientRect().height),
  visibility: getComputedStyle(full).visibility,
  expanded: q('.rail-toggle').getAttribute('aria-expanded'),
};
return { before, midH, after, jumped: midH === after.fullH };
