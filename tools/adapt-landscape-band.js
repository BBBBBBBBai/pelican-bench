/* 横屏：机架自己滚之后，日期带还钉不钉在滚动区顶端？ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const px = (v) => Math.round(v * 10) / 10;
const rs = document.querySelector('.rack-scroll');
const band = document.querySelector('.rack-band');
const rail = document.querySelector('.rail');
const out = {
  before: {
    bandVpY: px(band.getBoundingClientRect().y),
    bandPos: getComputedStyle(band).position,
    bandTop: getComputedStyle(band).top,
    railBottom: px(rail.getBoundingClientRect().bottom),
  },
};
rs.scrollTop = 900;
await sleep(350);
out.afterScroll = {
  innerTop: Math.round(rs.scrollTop),
  bandVpY: px(band.getBoundingClientRect().y),
  railBottom: px(rail.getBoundingClientRect().bottom),
  bandSitsUnderRail: Math.abs(band.getBoundingClientRect().y - rail.getBoundingClientRect().bottom) < 3,
  winY: Math.round(scrollY),
  hitAtBand: (() => {
    const el = document.elementFromPoint(200, Math.round(band.getBoundingClientRect().y) + 6);
    return el ? el.tagName + '.' + String(el.className).slice(0, 22) : null;
  })(),
};
out.bands = [...document.querySelectorAll('.rack-band')].map((b) => px(b.getBoundingClientRect().y));
// 真手指：在机架区竖着滑，应该滚机架不是滚页面
return out;
