// 全档位布局探针：手机 390×844、手机横屏 844×390、320×640、桌面 1440×900。
// 关键量：顶部两条 chrome 各占多高、「开始生成」离文档顶多远、横杆收成几行、
// 粘性元素之间还压不压得住。
const px = (v) => Math.round(v * 10) / 10;
const box = (sel) => {
  const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: px(r.x),
    vpY: px(r.y), // 视口坐标
    docY: px(r.y + window.scrollY), // 文档坐标
    h: px(r.height),
    w: px(r.width),
  };
};
const out = {
  vw: innerWidth,
  vh: innerHeight,
  pageH: px(document.documentElement.scrollHeight),
  rows: getComputedStyle(document.querySelector('.bench')).gridTemplateRows,
  areas: getComputedStyle(document.querySelector('.bench')).gridTemplateAreas,
  footer: getComputedStyle(document.querySelector('.bench')).gridTemplateColumns,
};
const busbar = document.querySelector('.busbar');
out.busbar = {
  ...box(busbar),
  rows: [...busbar.children].map((c) => ({
    cls: String(c.className).slice(0, 18),
    vpY: px(c.getBoundingClientRect().y),
    h: px(c.getBoundingClientRect().height),
    d: getComputedStyle(c).display,
  })),
};
out.rail = {
  ...box('.rail'),
  fullH: box('.rail-full')?.h ?? null,
  lineLineH: px(document.querySelector('.rail-line')?.getBoundingClientRect().height ?? 0),
  cur: document.querySelector('.rail-cur')?.textContent ?? null,
  expanded: document.querySelector('.rail-toggle')?.getAttribute('aria-expanded') ?? null,
  detentsH: box('.detents')?.h ?? null,
  detentCount: document.querySelectorAll('.detents > button').length,
};
out.panel = box('.panel');
out.bay = box('.bay');
out.sections = [...document.querySelectorAll('.panel .bay-section')].map((s) => ({
  head: (s.querySelector('.bay-head')?.textContent || '').trim().slice(0, 10),
  ...box(s),
}));
out.run = {
  dl: box('.panel .run-facts'),
  modelInput: box('#o-model'),
  mpGrid: box('.mp-grid'),
  mpCell: box('.mp-cell'),
  hint: box('#o-model-hint'),
  fold: box('.panel .fold'),
  start: box('.panel .btn.xl'),
};
// 第一屏能不能看到「开始生成」
out.startInFirstScreen = out.run.start ? out.run.start.vpY + out.run.start.h <= innerHeight : null;
out.startY = out.run.start?.vpY ?? null;

// 滚到画廊中段，看粘性元素各自钉在哪、有没有互相压
window.scrollTo(0, Math.round(out.bay.docY + 1500));
const vp = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { vpY: px(r.y), h: px(r.height) };
};
out.stuck = {
  scrollY: px(window.scrollY),
  rail: vp('.rail'),
  bands: [...document.querySelectorAll('.rack-band')].map((b) => px(b.getBoundingClientRect().y)),
  hitAtRailMid: (() => {
    const r = document.querySelector('.rail').getBoundingClientRect();
    const el = document.elementFromPoint(180, r.top + r.height / 2);
    return el ? el.tagName + '.' + String(el.className).slice(0, 20) : null;
  })(),
  hitJustUnderRail: (() => {
    const r = document.querySelector('.rail').getBoundingClientRect();
    const el = document.elementFromPoint(180, r.bottom + 4);
    return el ? el.tagName + '.' + String(el.className).slice(0, 20) : null;
  })(),
};
window.scrollTo(0, 0);
return out;
