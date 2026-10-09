/* 点开第一条「有图的」通道，让标本页出来 */
const cells = [...document.querySelectorAll('.ch')];
const withImg = cells.find((c) => c.querySelector('.ch-plate img'));
if (!withImg) return '没有带图的格子';
withImg.click();
await new Promise((r) => setTimeout(r, 1400));
const sheet = document.querySelector('.sheet');
if (!sheet) return '标本页没出来';
return {
  addr: sheet.querySelector('.sheet-addr')?.textContent?.trim(),
  hasPlate: Boolean(sheet.querySelector('.plate iframe')),
  plateBox: (() => {
    const b = sheet.querySelector('.plate')?.getBoundingClientRect();
    return b ? { w: Math.round(b.width), h: Math.round(b.height) } : null;
  })(),
  facts: [...sheet.querySelectorAll('.facts dt')].map((dt) => dt.textContent.trim()),
  folds: [...sheet.querySelectorAll('.fold > summary')].map((s) => s.textContent.trim()),
};
