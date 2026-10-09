/* 展开筛选横杆之后，它还是不是粘性的？（收起时 45px 钉得住，展开成 350px 之后要复核） */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const px = (v) => Math.round(v * 10) / 10;
const rail = document.querySelector('.rail');
const bay = document.querySelector('.bay');
const bench = document.querySelector('.bench');

const geom = (tag) => {
  const r = rail.getBoundingClientRect();
  const b = bay.getBoundingClientRect();
  const bn = bench.getBoundingClientRect();
  const cs = getComputedStyle(rail);
  return {
    tag,
    scrollY: Math.round(window.scrollY),
    railVpY: px(r.y),
    railH: px(r.height),
    railBottom: px(r.bottom),
    bayTop: px(b.y),
    bayH: px(b.height),
    benchH: px(bn.height),
    pos: cs.position,
    top: cs.top,
    z: cs.zIndex,
    alignSelf: cs.alignSelf,
    overflow: cs.overflow,
  };
};

const out = { closedAt0: geom('closed@0') };
window.scrollTo(0, 2600);
await sleep(300);
out.closedScrolled = geom('closed@2600');

document.querySelector('.rail-toggle').click();
await sleep(500);
out.openScrolled = geom('open@2600');
out.hitAtRailTop = (() => {
  const r = rail.getBoundingClientRect();
  const el = document.elementFromPoint(180, Math.max(1, Math.round(r.top) + 6));
  return el ? el.tagName + '.' + String(el.className).slice(0, 24) : null;
})();
return out;
