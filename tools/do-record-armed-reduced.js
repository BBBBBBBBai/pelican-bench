// --do 文件：减弱动效下确认「扣闩」是不是**即时**的。
//
// 这台仪器对 reduce 的处理范式是「抹掉位移、留住淡入淡出」，而扣闩这件事
// 根本没有位移可抹 —— 它是纯色 + inset 凹槽。所以这里要量的是：
// 点下去之后多少毫秒，凹槽已经是终态。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cell = [...document.querySelectorAll('.ch')].find((c) => c.querySelector('.ch-plate img'));
cell?.click();
await sleep(1500);

const btn = document.querySelector('.sheet .btn.halt');
if (!btn) return { error: '标本页没出来' };

const armed = () => btn.classList.contains('armed');
const shadow = () => getComputedStyle(btn).boxShadow;

const t0 = performance.now();
btn.click();
const before = shadow();

// 逐帧看到底态
let ms = null;
for (let i = 0; i < 60; i += 1) {
  await sleep(8);
  if (armed()) { ms = Math.round(performance.now() - t0); break; }
}

return {
  armedAfterMs: ms,
  armedClass: armed(),
  ariaPressed: btn.getAttribute('aria-pressed'),
  label: btn.textContent.trim(),
  // reduce 下 transition-duration 应当已被压到 0.001ms，所以这里应该
  // 「点完即终态」，而不是花 180ms 渐变
  shadowBefore: before,
  shadowAfter: shadow(),
  instant: ms !== null && ms < 120,
};
