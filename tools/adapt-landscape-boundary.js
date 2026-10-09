/* 手机横屏那一档的边界：宽 ≥560 且高 ≤520 才回两列。这里只报事实。 */
return {
  vw: innerWidth,
  vh: innerHeight,
  areas: getComputedStyle(document.querySelector('.bench')).gridTemplateAreas,
  cols: getComputedStyle(document.querySelector('.bench')).gridTemplateColumns,
  matchesLandscapeQuery: matchMedia('(max-width: 900px) and (min-width: 560px) and (max-height: 520px)').matches,
  matchesCoarse: matchMedia('(pointer: coarse)').matches,
  panelW: Math.round(document.querySelector('.panel').getBoundingClientRect().width),
  panelBorderLeft: getComputedStyle(document.querySelector('.panel')).borderLeftWidth,
  panelBorderTop: getComputedStyle(document.querySelector('.panel')).borderTopWidth,
  rackBandTop: getComputedStyle(document.querySelector('.rack-band')).top,
  railLineDisplay: getComputedStyle(document.querySelector('.rail-line')).display,
  docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  scrollsPage: document.documentElement.scrollHeight > innerHeight + 2,
};
