// --do 文件：在 8787 的生产包上确认这块编辑面真的在（build 之后跑）。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
document.querySelector('.preset-head')?.scrollIntoView({ block: 'center' });
await sleep(400);
const list = document.querySelector('.preset-list');
const restore = document.querySelector('.preset-head button');
return {
  inProd: !!list,
  rows: document.querySelectorAll('.preset-row').length,
  headLabel: document.querySelector('.preset-head .silk')?.textContent.trim(),
  restoreText: restore?.textContent.trim(),
  restoreDisabled: restore?.disabled,
  listH: list ? Math.round(list.getBoundingClientRect().height) : 0,
  nameFont: getComputedStyle(document.querySelector('.preset-name')).fontFamily.split(',')[0],
  nameBorder: getComputedStyle(document.querySelector('.preset-name')).borderTopWidth,
  overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
};
