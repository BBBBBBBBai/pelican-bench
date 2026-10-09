// --do 文件：英文界面下把「删除」扣成 CONFIRM DELETE，量它装不装得下。
// 英文比中文长得多（DELETE → CONFIRM DELETE），两列等宽的格子里最容易被撑破的就是它。
// 注意：切语言会写进 config.json 的 uiLang —— 跑完必须切回中文。
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
const edit = document.querySelector('.prov-slot-out button:not(.halt)');
const idleLabel = btn?.textContent.trim();
btn?.click();
await sleep(400);

const cs = btn ? getComputedStyle(btn) : null;
const out = {
  idleLabel,
  label: btn?.textContent.trim(),
  armed: btn?.classList.contains('armed'),
  scrollW: btn?.scrollWidth,
  clientW: btn?.clientWidth,
  overflowPx: btn ? btn.scrollWidth - btn.clientWidth : null,
  editW: edit?.getBoundingClientRect().width,
  deleteW: btn?.getBoundingClientRect().width,
  background: cs?.backgroundColor,
  borderColor: cs?.borderTopColor,
  // 整页有没有被这行字撑出横向滚动
  docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  overflowing: [...document.querySelectorAll('*')]
    .filter((e) => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0)
    .map((e) => `${e.tagName}.${String(e.className).slice(0, 30)} ${e.scrollWidth}>${e.clientWidth}`)
    .slice(0, 8),
};

// 收尾：切回中文（会写 config.json，别把界面留在英文）
[...document.querySelectorAll('.sw')].forEach((s) => {
  [...s.querySelectorAll('button')].forEach((b) => {
    if (b.textContent.trim() === '中') b.click();
  });
});
await sleep(700);

document.querySelector('.prov-slot')?.scrollIntoView({ block: 'center' });
await sleep(200);
return out;
