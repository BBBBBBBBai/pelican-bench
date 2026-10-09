(async () => {
  const cells = [...document.querySelectorAll('.ch')];
  const rows = new Map();
  for (const c of cells) {
    const top = Math.round(c.getBoundingClientRect().top);
    if (!rows.has(top)) rows.set(top, []);
    rows.get(top).push(Math.round(c.getBoundingClientRect().height * 10) / 10);
  }
  const grid = [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([top, hs], i) => ({
      row: i + 1,
      top,
      cells: hs.length,
      heights: [...new Set(hs)],
      uniformWithinRow: new Set(hs).size === 1,
    }));
  // 也要确认每一行的画面仍然是 4:3（作品可不可以直接比大小）
  const plate = (() => {
    const ratios = new Set();
    for (const c of cells) {
      const p = c.querySelector('.ch-plate');
      if (!p) continue;
      const r = p.getBoundingClientRect();
      ratios.add(Math.round((r.width / r.height) * 100) / 100);
    }
    return [...ratios];
  })();
  return {
    allRowsUniform: grid.every((r) => r.uniformWithinRow),
    distinctRowHeights: [...new Set(grid.map((r) => r.heights[0]))].sort((a, b) => a - b),
    plateRatios: plate,
    grid,
  };
})()
