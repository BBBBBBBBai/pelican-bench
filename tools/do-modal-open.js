// 打开标本弹窗，停在稳定帧，供截图。
// 用 `--do=` 调用。
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 优先挑一个「有图」的格子，弹窗里那块样板才有内容
const cell = document.querySelector('.ch:not(.live)');
if (!cell) return { error: 'no cell' };
cell.click();
await wait(1500);
return {
  open: !!document.querySelector('.sheet'),
  addr: document.querySelector('.sheet-addr')?.textContent,
};
