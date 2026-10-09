// 模型候选表在粗指针下的高度：它不能顶掉「开始生成」，也不该把整屏吃掉。
const px = (v) => Math.round(v * 10) / 10;
const box = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { vpY: px(r.y), h: px(r.height), w: px(r.width) };
};
const grid = document.querySelector('.mp-grid');
return {
  vh: innerHeight,
  grid: box(grid),
  scrollable: grid ? grid.scrollHeight > grid.clientHeight : null,
  gridScrollH: grid?.scrollHeight ?? null,
  cellH: box(document.querySelector('.mp-cell'))?.h,
  start: box(document.querySelector('.panel .btn.xl')),
  startInFirstScreen: (() => {
    const b = box(document.querySelector('.panel .btn.xl'));
    return b ? b.vpY + b.h <= innerHeight : null;
  })(),
  busbarH: box(document.querySelector('.busbar'))?.h,
  // 光标滑过候选表时会不会把整页也带着滚
  ov: grid ? getComputedStyle(grid).overflowY : null,
};
