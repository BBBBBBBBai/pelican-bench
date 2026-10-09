// reduced-motion 下弹窗的替代路径：位移应被抹掉，淡入淡出与状态必须留下。
// 用 `--do=` 调用。
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const cell = document.querySelector('.ch:not(.live)');
if (!cell) return { error: 'no cell' };
cell.click();
await wait(1300);

const sheet = document.querySelector('.sheet');
const scrim = document.querySelector('.sheet-scrim');
if (!sheet) return { error: 'no sheet' };

const cs = getComputedStyle(sheet);
const open = {
  animName: cs.animationName,
  animDur: cs.animationDuration,
  transform: cs.transform,
  opacity: cs.opacity,
  scrimAnim: scrim ? getComputedStyle(scrim).animationName : null,
};

// 退场采样
const closeBtn = sheet.querySelector('.sheet-head .btn.icon');
closeBtn.click();
const exit = [];
for (const t of [0, 40, 80, 160, 300]) {
  await wait(t === 0 ? 16 : 40);
  const s = document.querySelector('.sheet');
  exit.push({
    t,
    opacity: s ? getComputedStyle(s).opacity : null,
    transform: s ? getComputedStyle(s).transform : null,
    gone: !s,
  });
}
await wait(500);
return {
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  open,
  exit,
  finalGone: !document.querySelector('.sheet'),
  bodyChildren: [...document.body.children].map((c) => c.className || c.tagName),
};
