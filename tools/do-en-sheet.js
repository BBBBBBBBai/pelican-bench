/* 切到英文界面，再点开第一条有图的记录，用来核对英文长文案 */
const langSw = [...document.querySelectorAll('.sw')].find((s) =>
  [...s.querySelectorAll('button')].some((b) => b.textContent.trim() === 'EN'),
);
if (!langSw) return '没找到语言切换';
langSw.querySelectorAll('button').forEach((b) => {
  if (b.textContent.trim() === 'EN') b.click();
});
await new Promise((r) => setTimeout(r, 900));

const cells = [...document.querySelectorAll('.ch')];
const withImg = cells.find((c) => c.querySelector('.ch-plate img'));
if (!withImg) return '没有带图的格子';
withImg.click();
await new Promise((r) => setTimeout(r, 1400));
const sheet = document.querySelector('.sheet');
if (!sheet) return '详情没出来';
return {
  addr: sheet.querySelector('.sheet-addr')?.textContent?.trim(),
  facts: [...sheet.querySelectorAll('.facts dt')].map((dt) => dt.textContent.trim()),
  values: [...sheet.querySelectorAll('.facts dd')].map((dd) => dd.textContent.trim()),
  folds: [...sheet.querySelectorAll('.fold > summary')].map((s) => s.textContent.trim()),
  hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
};
