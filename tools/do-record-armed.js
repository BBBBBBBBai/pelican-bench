// --do 文件：把标本页的「删除」扣成「确认删除」并留在那儿，供截图看真实样子。
// 只扣闩，不删 —— 第一次点本来就没有副作用，所以对真记录是安全的。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 挑一条真的有图的记录，这样面板上半部分是满的，截图能看出上下文
const cell = [...document.querySelectorAll('.ch')].find((c) => c.querySelector('.ch-plate img'));
cell?.click();
await sleep(1400);

const btn = document.querySelector('.sheet .btn.halt');
btn?.click();
await sleep(400);

// 长出来的字和那句后果说明都要进画面
document.querySelector('.sheet .note[role="status"]')?.scrollIntoView({ block: 'center' });
await sleep(280);

const cs = btn ? getComputedStyle(btn) : null;
const warn = document.querySelector('.sheet .note[role="status"]');
return {
  label: btn?.textContent.trim(),
  armed: btn?.classList.contains('armed'),
  ariaPressed: btn?.getAttribute('aria-pressed'),
  background: cs?.backgroundColor,
  borderColor: cs?.borderTopColor,
  boxShadow: cs?.boxShadow,
  // 长出来的四个字装不装得下
  scrollW: btn?.scrollWidth,
  clientW: btn?.clientWidth,
  overflowPx: btn ? btn.scrollWidth - btn.clientWidth : null,
  warnShown: Boolean(warn),
  warnText: warn?.textContent.trim() ?? null,
  sheetOpen: Boolean(document.querySelector('.sheet')),
};
