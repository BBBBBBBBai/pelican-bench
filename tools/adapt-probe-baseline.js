// 手机断点改造前的基线：粘性重叠、触控目标、媒体查询能力
const px = (v) => Math.round(v * 10) / 10;
const R = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height) };
};
const q = (s) => document.querySelector(s);
const out = {};

out.mq = {
  coarse: matchMedia('(pointer: coarse)').matches,
  fine: matchMedia('(pointer: fine)').matches,
  hoverHover: matchMedia('(hover: hover)').matches,
  anyCoarse: matchMedia('(any-pointer: coarse)').matches,
  w900: matchMedia('(max-width: 900px)').matches,
  w620: matchMedia('(max-width: 620px)').matches,
};
out.env = {
  vw: innerWidth,
  vh: innerHeight,
  pageH: document.documentElement.scrollHeight,
  scroller: document.scrollingElement === document.documentElement ? 'html' : 'body',
};

out.chrome = { busbar: R(q('.busbar')), rail: R(q('.rail')), bench: R(q('.bench')), bay: R(q('.bay')), panel: R(q('.panel')) };

// 滚到画廊里，看粘性的 rail 与 rack-band 谁盖谁
document.scrollingElement.scrollTop = 900;
await new Promise((r) => setTimeout(r, 350));
out.sticky = {
  scroll: document.scrollingElement.scrollTop,
  rail: R(q('.rail')),
  band: R(q('.rack-band')),
  busbar: R(q('.busbar')),
  hitAtRailMid: (() => {
    const el = document.elementFromPoint(180, 20);
    return el ? `${el.tagName}.${String(el.className).slice(0, 24)}` : null;
  })(),
  hitAtBandMid: (() => {
    const rail = q('.rail');
    if (!rail) return null;
    const y = rail.getBoundingClientRect().bottom + 8;
    const el = document.elementFromPoint(180, y);
    return el ? `${el.tagName}.${String(el.className).slice(0, 24)} @${px(y)}` : null;
  })(),
};
document.scrollingElement.scrollTop = 0;
await new Promise((r) => setTimeout(r, 250));

out.smallTargets = [...document.querySelectorAll('button, a, select, input, summary')]
  .map((el) => ({ el, b: R(el) }))
  .filter(({ b }) => b && b.w > 0 && (b.w < 44 || b.h < 44))
  .map(({ el, b }) => ({
    tag: el.tagName.toLowerCase(),
    cls: String(el.className).slice(0, 26),
    txt: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 12),
    w: b.w,
    h: b.h,
  }));

out.railGroups = [...document.querySelectorAll('.rail > *')].map((el) => ({ cls: String(el.className).slice(0, 20), ...R(el) }));
out.detents = R(q('.detents'));
out.detentCount = document.querySelectorAll('.detents > button').length;

return out;
