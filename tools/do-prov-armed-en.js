// --do 文件：英文界面下把「删除」扣成 CONFIRM DELETE 并**留在英文**，供截图。
// 与 do-prov-confirm-en.js 的区别：那个跑完切回中文（所以截图还是中文），
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

document.querySelector('.roster .slot')?.click();
await sleep(400);

const btn = document.querySelector('.prov-slot-out button.halt');
btn?.click();
await sleep(400);

document.querySelector('.prov-slot')?.scrollIntoView({ block: 'center' });
await sleep(250);

return {
  label: btn?.textContent.trim(),
  armed: btn?.classList.contains('armed'),
  overflowPx: btn ? btn.scrollWidth - btn.clientWidth : null,
  editW: document.querySelector('.prov-slot-out button:not(.halt)')?.getBoundingClientRect().width,
  deleteW: btn?.getBoundingClientRect().width,
};
