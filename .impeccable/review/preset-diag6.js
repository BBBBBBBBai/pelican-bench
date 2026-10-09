// 诊断 6：先证明「合成 keydown 到底能不能喂到 React 的 onKeyDown」。
// 拿现成的「要测哪个模型」输入框验（它 OnKeyDown 里 ArrowDown 会把游标下移，
// 表现为某个 .mp-cell 拿到 data-active="true"）。这一步不碰任何真数据。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const mi = document.querySelector('.mp-input');
if (!mi) return { err: 'no .mp-input' };

const out = { found: true };
mi.focus();
await sleep(150);
out.focusOk = document.activeElement === mi;

mi.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, cancelable: true }));
await sleep(200);
out.activeAfterSynthetic = document.querySelectorAll('.mp-cell[data-active="true"]').length;

// 再来一次带 composed 的，排除事件选项差异
mi.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, cancelable: true, composed: true }));
await sleep(200);
out.activeAfterComposed = document.querySelectorAll('.mp-cell[data-active="true"]').length;

out.inputStillThere = document.querySelector('.mp-input') === mi;
out.activeEl = document.activeElement?.className;
return out;
