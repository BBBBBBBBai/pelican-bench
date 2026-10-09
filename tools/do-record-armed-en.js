// --do 文件：英文界面下把标本页「删除」扣成 CONFIRM DELETE 并**留在英文**，供截图。
// 与 do-record-confirm-en.js 的区别：那个跑完切回中文（所以截图还是中文），
// 这个不切回来 —— 截图在外面拍，得留着英文。
// ⚠️ 会把 config.json 的 uiLang 写成 en，拍完必须用 node 改回 zh。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const langSw = [...document.querySelectorAll('.sw')].find((s) =>
  [...s.querySelectorAll('button')].some((b) => b.textContent.trim() === 'EN'),
);
langSw?.querySelectorAll('button').forEach((b) => {
  if (b.textContent.trim() === 'EN') b.click();
});
await sleep(900);

const cell = [...document.querySelectorAll('.ch')].find((c) => c.querySelector('.ch-plate img'));
cell?.click();
await sleep(1400);

const btn = document.querySelector('.sheet .btn.halt');
btn?.click();
await sleep(400);

document.querySelector('.sheet .note[role="status"]')?.scrollIntoView({ block: 'center' });
await sleep(280);

const warn = document.querySelector('.sheet .note[role="status"]');
return {
  label: btn?.textContent.trim(),
  armed: btn?.classList.contains('armed'),
  ariaPressed: btn?.getAttribute('aria-pressed'),
  overflowPx: btn ? btn.scrollWidth - btn.clientWidth : null,
  warnShown: Boolean(warn),
  warnText: warn?.textContent.trim() ?? null,
};
