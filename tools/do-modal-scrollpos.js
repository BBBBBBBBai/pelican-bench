// 打开弹窗时锁定滚动，不能把用户原本的滚动位置弄丢；关闭后要回到原位。
// 用 `--do=` 调用。
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

window.scrollTo(0, 1400);
await wait(200);
const before = window.scrollY;

document.querySelector('.ch:not(.live)').click();
await wait(1300);
const duringOpen = window.scrollY;

// 关闭
document.querySelector('.sheet-head .btn.icon').click();
await wait(800);
const afterClose = window.scrollY;

return {
  before,
  duringOpen,
  afterClose,
  preservedWhileOpen: duringOpen === before,
  restoredAfterClose: afterClose === before,
  htmlOverflow: getComputedStyle(document.documentElement).overflowY,
};
