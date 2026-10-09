// --do 文件：减少动效下的两段式删除。
// 闩的反馈是「键扣下去了」这件事本身（凹槽 + 刻线），不是一次动画，
// 所以 reduce 下它必须照常出现——只该更快，不该消失。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const btn = () => document.querySelector('.prov-slot-out button.halt');
const skin = (el) => {
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    label: el.textContent.trim(),
    armed: el.classList.contains('armed'),
    background: cs.backgroundColor,
    borderColor: cs.borderTopColor,
    boxShadow: cs.boxShadow,
    transitionDuration: cs.transitionDuration,
    transitionProperty: cs.transitionProperty,
  };
};

document.querySelector('.roster .slot')?.click();
await sleep(300);

const before = skin(btn());
const t0 = performance.now();
btn()?.click();
await sleep(60); // 远短于 0.18s：如果还依赖动画，这里就该量到中间态
const early = skin(btn());
const earlyMs = Math.round(performance.now() - t0);

await sleep(300);
const settled = skin(btn());

return {
  mediaReduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  before,
  early,
  earlyMs,
  settled,
  // 三条断言：状态在、文字换了、颜色真的变了
  statePresent: settled?.armed === true,
  labelChanged: before?.label === '删除' && settled?.label === '确认删除',
  // 凹槽与刻线不靠动画承载，所以 60ms 时就应该已经是终态
  instant:
    early?.background === settled?.background &&
    early?.borderColor === settled?.borderColor &&
    early?.label === settled?.label,
};
