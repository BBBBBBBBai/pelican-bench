// 打开弹窗后采样进场过程的几何与不透明度，确认「摆上去」而不是「飞进来」。
// 用 `--do=` 调用。
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = [];
const cell = document.querySelector('.ch:not(.live)');
if (!cell) return { error: 'no cell' };
cell.click();
const t0 = performance.now();
for (let i = 0; i < 9; i++) {
  await wait(i === 0 ? 16 : 30);
  const s = document.querySelector('.sheet');
  const sc = document.querySelector('.sheet-scrim');
  frames.push({
    t: Math.round(performance.now() - t0),
    sheetOpacity: s ? Number(getComputedStyle(s).opacity).toFixed(3) : null,
    sheetShift: s ? getComputedStyle(s).transform : null,
    scrimOpacity: sc ? Number(getComputedStyle(sc).opacity).toFixed(3) : null,
    plateCls: document.querySelector('.sheet-plate')?.className ?? null,
  });
}
await wait(600);
const s = document.querySelector('.sheet');
const r = s?.getBoundingClientRect();
return {
  frames,
  settled: s
    ? { opacity: getComputedStyle(s).opacity, transform: getComputedStyle(s).transform }
    : null,
  finalBox: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
};
