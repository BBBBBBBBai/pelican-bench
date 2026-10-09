// 切到英文界面再打开弹窗，检查英文标签在弹窗里放不放得下。
// 用 `--do=` 调用。
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const enBtn = [...document.querySelectorAll('.sw button')].find((b) => b.textContent.trim() === 'EN');
if (!enBtn) return { error: 'no EN button' };
enBtn.click();
await wait(900);

document.querySelector('.ch:not(.live)').click();
await wait(1400);

const sheet = document.querySelector('.sheet');
if (!sheet) return { error: 'no sheet after open', lang: document.documentElement.lang };

const overflowing = [...sheet.querySelectorAll('*')]
  .filter((el) => el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'hidden')
  .map((el) => ({ cls: el.className, text: (el.textContent || '').slice(0, 40), sw: el.scrollWidth, cw: el.clientWidth }));

const dts = [...sheet.querySelectorAll('.facts dt')].map((d) => d.textContent.trim());
const btns = [...sheet.querySelectorAll('.sheet .btn')].map((b) => b.textContent.trim());
const head = [...sheet.querySelector('.sheet-head').children].map((c) => ({
  cls: c.className,
  text: (c.textContent || '').slice(0, 40),
  w: Math.round(c.getBoundingClientRect().width),
}));

return {
  lang: document.documentElement.lang,
  addr: sheet.querySelector('.sheet-addr')?.textContent,
  head,
  headScrollW: sheet.querySelector('.sheet-head').scrollWidth,
  headClientW: sheet.querySelector('.sheet-head').clientWidth,
  sheetScrollW: sheet.scrollWidth,
  sheetClientW: sheet.clientWidth,
  overflowing,
  dtCount: dts.length,
  factsDts: dts,
  btns,
  docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
};
