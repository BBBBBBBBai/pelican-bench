(() => {
  const px = (v) => Math.round(v * 10) / 10;
  const r = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { top: px(b.top), h: px(b.height), w: px(b.width) };
  };
  const cs = (sel, p) => {
    const e = document.querySelector(sel);
    return e ? getComputedStyle(e)[p] : null;
  };
  const secs = [...document.querySelectorAll('.bay-section')].map((s) => {
    const b = s.getBoundingClientRect();
    return {
      head: (s.querySelector('.bay-head .silk, .bay-head b, .bay-head')?.textContent || '').trim().slice(0, 14),
      top: px(b.top), h: px(b.height),
    };
  });
  const armBtn = document.querySelector('.btn.arm.xl.wide, .btn.halt.xl.wide');
  const armB = armBtn ? armBtn.getBoundingClientRect() : null;
  const det = document.querySelector('.detents');
  const rail = document.querySelector('.rail');
  // 返回顶部以后量「首屏预算」：视口里各带各占多少
  window.scrollTo(0, 0);
  const vh = innerHeight;
  const busB = document.querySelector('.busbar')?.getBoundingClientRect();
  const railB = rail?.getBoundingClientRect();
  return {
    vh,
    vw: innerWidth,
    pageH: document.documentElement.scrollHeight,
    bodyScrollTop: document.scrollingElement.scrollTop,
    busbar: r('.busbar'),
    busbarWrap: cs('.busbar', 'flexWrap'),
    busbarRows: busB ? Math.round(busB.height / 54) : null,
    rail: r('.rail'),
    railRows: railB && rail ? Math.round(railB.height / 34) : null,
    detents: r('.detents'),
    detentsH: det ? px(det.getBoundingClientRect().height) : null,
    detentCount: det ? det.querySelectorAll('button').length : null,
    railFirstTop: railB ? px(railB.top) : null,
    railBottom: railB ? px(railB.bottom) : null,
    firstChromeBottom: railB ? px(railB.bottom) : null,
    chromeShare: railB ? px((railB.bottom / vh) * 100) : null,
    rackScroll: r('.rack-scroll'),
    rackScrollPort: (() => {
      const e = document.querySelector('.rack-scroll');
      return e ? { client: e.clientHeight, scroll: e.scrollHeight, isPort: e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflowY === 'auto' } : null;
    })(),
    bay: r('.bay'),
    panel: r('.panel'),
    panelScrollPort: (() => {
      const e = document.querySelector('.panel-scroll');
      return e ? { client: e.clientHeight, scroll: e.scrollHeight } : null;
    })(),
    sections: secs,
    modelInput: r('#o-model'),
    mpGrid: r('#mp-grid'),
    armBtn: armB ? { top: px(armB.top), h: px(armB.height) } : null,
    benchCols: cs('.bench', 'gridTemplateColumns'),
    benchRows: cs('.bench', 'gridTemplateRows'),
    benchH: cs('.bench', 'height'),
  };
})()
