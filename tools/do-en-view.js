/* 切到英文界面，把画廊 + 顶栏 + 筛选条 + 右栏的英文文案都摊开，核对是否撑破布局 */
const langSw = [...document.querySelectorAll('.sw')].find((s) =>
  [...s.querySelectorAll('button')].some((b) => b.textContent.trim() === 'EN'),
);
if (!langSw) return '没找到语言切换';
langSw.querySelectorAll('button').forEach((b) => {
  if (b.textContent.trim() === 'EN') b.click();
});
await new Promise((r) => setTimeout(r, 900));

const overflowing = [...document.querySelectorAll('*')]
  .filter((e) => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0)
  .map((e) => `${e.tagName}.${String(e.className).slice(0, 40)} ${e.scrollWidth}>${e.clientWidth}`)
  .slice(0, 12);

return {
  docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  overflowing,
  busbar: document.querySelector('.busbar')?.textContent?.replace(/\s+/g, ' ').trim(),
  rail: document.querySelector('.rail')?.textContent?.replace(/\s+/g, ' ').trim(),
  band: document.querySelector('.rack-band')?.textContent?.replace(/\s+/g, ' ').trim(),
};
