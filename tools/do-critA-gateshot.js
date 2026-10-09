// 门禁禁用态放大截图：把「本次运行」这一段连同 .mp-grid 与 .btn.arm 一起放大到能看清字，
// 目标是判断禁用的「开始生成」到底还亮不亮。
(async () => {
  const input = document.querySelector('.mp-input');
  if (input) {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await new Promise((r) => setTimeout(r, 200));
  const pick = document.querySelector('.model-pick');
  pick.scrollIntoView({ block: 'center' });
  await new Promise((r) => setTimeout(r, 250));
  // 把 .model-pick .. .btn.arm 这一段整体放大
  const wrap = pick.parentElement;
  wrap.style.transformOrigin = '0 0';
  wrap.style.transform = 'scale(1.6)';
  wrap.style.width = '62.5%';
  document.body.style.overflowX = 'hidden';
  const arm = document.querySelector('.btn.arm.xl.wide');
  return JSON.stringify({
    armDisabled: arm.disabled,
    armColor: getComputedStyle(arm).color,
    armTitle: arm.title,
    wrapRect: wrap.getBoundingClientRect().toJSON(),
  });
})()
