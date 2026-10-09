/* 总线条在手机上为什么会折成两行：量每个子项的自然宽度与折行位置，
   看清哪一项是「挤出第二行」的那一项。 */
const px = (v) => Math.round(v * 10) / 10;
const bar = document.querySelector('.busbar');
const cs = getComputedStyle(bar);
const kids = [...bar.children].map((k) => {
  const r = k.getBoundingClientRect();
  return {
    cls: String(k.className) || k.tagName,
    x: px(r.x),
    y: px(r.y),
    w: px(r.width),
    h: px(r.height),
    d: getComputedStyle(k).display,
  };
});
const inner = [...bar.querySelectorAll('.nameplate > *, .window > *')].map((k) => {
  const r = k.getBoundingClientRect();
  return { cls: String(k.className) || k.tagName, tag: k.tagName, text: (k.textContent || '').trim().slice(0, 22), w: px(r.width), h: px(r.height) };
});
const nameplate = document.querySelector('.nameplate');
return {
  vw: innerWidth,
  barPad: cs.padding,
  barGap: cs.gap,
  barH: px(bar.getBoundingClientRect().height),
  barScrollW: bar.scrollWidth,
  nameplateW: px(nameplate.getBoundingClientRect().width),
  sumKidW: px(kids.filter((k) => k.d !== 'none').reduce((a, k) => a + k.w, 0)),
  kids,
  inner,
};
