/* 横屏那一档：整页到底有没有溢出？如果有，是谁多出来的那几 px。 */
const px = (v) => Math.round(v * 10) / 10;
const de = document.documentElement;
const bench = document.querySelector('.bench');
const kids = [...bench.children].map((k) => {
  const r = k.getBoundingClientRect();
  return { cls: String(k.className), h: px(r.height), top: px(r.top), bottom: px(r.bottom) };
});
return {
  vh: innerHeight,
  docScrollH: de.scrollHeight,
  bodyScrollH: document.body.scrollHeight,
  benchH: px(bench.getBoundingClientRect().height),
  overflowBy: de.scrollHeight - innerHeight,
  kids,
  panel: (() => {
    const p = document.querySelector('.panel');
    const s = document.querySelector('.panel-scroll');
    return { h: px(p.getBoundingClientRect().height), scrollH: p.scrollHeight, innerScroll: s.scrollHeight, innerClient: s.clientHeight, canScroll: s.scrollHeight > s.clientHeight + 1 };
  })(),
};
