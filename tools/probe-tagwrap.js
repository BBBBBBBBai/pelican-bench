(async () => {
  const measure = () => {
    const cells = [...document.querySelectorAll('.ch')];
    const heights = new Set();
    const tagSlots = new Set();
    for (const c of cells) {
      heights.add(Math.round(c.getBoundingClientRect().height * 10) / 10);
      tagSlots.add(
        Math.round(c.querySelector('.tags').getBoundingClientRect().height * 10) / 10
      );
    }
    return { cellHeights: [...heights].sort((a, b) => a - b), tagSlots: [...tagSlots].sort((a, b) => a - b) };
  };

  const style = document.createElement('style');
  style.textContent = '.tag{font-size:10px !important;letter-spacing:0.11em !important}';
  document.head.appendChild(style);
  const before = measure();
  style.remove();
  const after = measure();

  // 还要看每格到底挂了几个牌子、多宽
  const cells = [...document.querySelectorAll('.ch')];
  const perCell = cells.map((c) => {
    const tags = [...c.querySelectorAll('.tag')];
    return {
      no: c.querySelector('.ch-no')?.textContent,
      tags: tags.map((t) => {
        const r = t.getBoundingClientRect();
        return t.textContent + ':' + Math.round(r.width);
      }),
      slotW: Math.round(c.querySelector('.tags').clientWidth),
    };
  });

  return { withOldTagMetrics: before, withCurrentTagMetrics: after, perCell };
})()
