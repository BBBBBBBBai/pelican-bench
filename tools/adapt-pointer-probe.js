(() => {
  // 手指还是鼠标：媒体特性在没开触摸仿真时会说谎（--mobile 只改视口尺寸）
  const mq = (q) => matchMedia(q).matches;
  return {
    coarse: mq('(pointer: coarse)'),
    fine: mq('(pointer: fine)'),
    anyCoarse: mq('(any-pointer: coarse)'),
    hoverNone: mq('(hover: none)'),
    touchPoints: navigator.maxTouchPoints,
    w900: mq('(max-width: 900px)'),
  };
})()
