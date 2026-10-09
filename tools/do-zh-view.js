/* 切回中文界面（英文巡检会把 uiLang 存进 config，必须还原） */
const langSw = [...document.querySelectorAll('.sw')].find((s) =>
  [...s.querySelectorAll('button')].some((b) => b.textContent.trim() === '中'),
);
if (!langSw) return '没找到语言切换';
langSw.querySelectorAll('button').forEach((b) => {
  if (b.textContent.trim() === '中') b.click();
});
await new Promise((r) => setTimeout(r, 1200));
return {
  lang: document.documentElement.lang,
  busbar: document.querySelector('.busbar')?.textContent?.replace(/\s+/g, ' ').trim(),
};
