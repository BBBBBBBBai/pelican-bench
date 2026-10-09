/* 点开 CH 01（鹈鹕那条真实记录，是唯一带 rx 圆角背景 <rect> 的画），让标本页出来 */
const cells = [...document.querySelectorAll('.ch')];
const target = cells.find((c) => c.querySelector('.ch-no')?.textContent?.trim() === 'CH 01');
if (!target) return '没有找到 CH 01';
target.click();
await new Promise((r) => setTimeout(r, 1600));
const sheet = document.querySelector('.sheet');
if (!sheet) return '标本页没出来';
const iframe = sheet.querySelector('.plate iframe');
const box = iframe?.getBoundingClientRect();
return {
  addr: sheet.querySelector('.sheet-addr')?.textContent?.trim(),
  animal: sheet.querySelector('.sheet-animal')?.textContent?.trim(),
  hasIframe: Boolean(iframe),
  plateBox: box ? { w: Math.round(box.width), h: Math.round(box.height) } : null,
  foldCount: sheet.querySelectorAll('.fold > summary').length,
};
