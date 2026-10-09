// 键盘流：打开 → Esc 关闭 → 焦点归位 → 再打开 → 关闭按钮 → 焦点归位。
// 用真实 CDP 键盘事件（`--do` 里的合成 keydown 无法真正移动焦点，
// 这里只用它验证 React handler；真实按键见 probe-modal-focus.mjs）。
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const active = () => {
  const el = document.activeElement;
  return el ? `${el.tagName}.${el.className || ''}`.slice(0, 60) : null;
};
const out = {};

const firstCell = document.querySelector('.ch:not(.live)');
firstCell.focus();
out.openerFocused = active();
firstCell.click();
await wait(1300);
out.afterOpen = active();

document.querySelector('.sheet-head .btn.icon').click();
await wait(700);
out.afterCloseButton = active();
out.sheetGone = !document.querySelector('.sheet');
out.rootInert = document.getElementById('root')?.hasAttribute('inert');
out.htmlOverflow = getComputedStyle(document.documentElement).overflowY;

return out;
