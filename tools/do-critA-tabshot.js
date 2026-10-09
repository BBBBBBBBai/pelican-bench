// 桌面 1440 下「键盘 Tab 到第 3 个模型行」的截图：验证 :focus-visible 是否真的给行套上琥珀 outline。
// 用 CDP 键盘真实 Tab（rawKeyDown 的 Tab 是会被浏览器当作键盘模态的）。
(async () => {
  const i = document.querySelector('.mp-input');
  i.scrollIntoView({ block: 'center' });
  i.focus();
  await new Promise((r) => setTimeout(r, 200));
  return 'focused input';
})()
