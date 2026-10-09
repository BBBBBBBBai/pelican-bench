// --do 文件：把「确认删除」那颗键扣下去并留在那儿，供截图看真实样子。
// 只扣闩，不删 —— 第一次点本来就没有副作用，所以对真档案是安全的。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

document.querySelector('.roster .slot')?.click();
await sleep(400);

const btn = document.querySelector('.prov-slot-out button.halt');
btn?.click();
await sleep(400);

document.querySelector('.prov-slot')?.scrollIntoView({ block: 'center' });
await sleep(250);

const cs = btn ? getComputedStyle(btn) : null;
return {
  label: btn?.textContent.trim(),
  armed: btn?.classList.contains('armed'),
  background: cs?.backgroundColor,
  borderColor: cs?.borderTopColor,
  boxShadow: cs?.boxShadow,
  // 长出来的字装不装得下
  scrollW: btn?.scrollWidth,
  clientW: btn?.clientWidth,
  overflowPx: btn ? btn.scrollWidth - btn.clientWidth : null,
  // 并排那颗「编辑供应商」的宽度，用来确认两列还是等宽
  editW: document.querySelector('.prov-slot-out button:not(.halt)')?.getBoundingClientRect().width,
  deleteW: btn?.getBoundingClientRect().width,
};
