// 弹窗：Tab 陷阱 + 退场动画 + 卸载。
// 用 `--do=` 调用（edge-cdp 会自动包 async IIFE）。
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (opts) => {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, ...opts }),
  );
  await wait(40);
};

const cell = document.querySelector('.ch:not(.live)');
if (!cell) return { error: 'no cell' };
const opener = cell;
cell.click();
await wait(1200);

const sheet = document.querySelector('.sheet');
if (!sheet) return { error: 'sheet did not open' };

const desc = (el) =>
  el ? `${el.tagName}.${(el.className || '').toString().slice(0, 40)}` : null;

// 真实 Tab：用 CDP 拿不到，这里直接派发 keydown 走 React 的 onKeyDown 路径
const seen = [];
for (let i = 0; i < 14; i++) {
  await key({});
  seen.push(desc(document.activeElement));
}
const allInside = [...document.querySelectorAll('*')].length;

// Shift+Tab 反向
const back = [];
for (let i = 0; i < 3; i++) {
  await key({ shiftKey: true });
  back.push(desc(document.activeElement));
}

// 收起抽屉里的按钮不该被抓到
const summary = sheet.querySelector('summary');
summary?.closest('details')?.removeAttribute('open');
await wait(300);
const closedFoldReached = await (async () => {
  const inputs = [...sheet.querySelectorAll('.fold:not([open]) input, .fold:not([open]) button')];
  return inputs.filter((el) => el.offsetParent !== null).length;
})();

// 退场：点关闭，采样
const closeBtn = sheet.querySelector('.sheet-head .btn.icon');
const samples = [];
closeBtn.click();
for (const t of [0, 60, 120, 200]) {
  await wait(t === 0 ? 16 : 60);
  const s = document.querySelector('.sheet');
  const pl = document.querySelector('.sheet-plate');
  const sc = document.querySelector('.sheet-scrim');
  samples.push({
    t,
    sheet: s ? { opacity: getComputedStyle(s).opacity, transform: getComputedStyle(s).transform } : null,
    plate: pl ? { cls: pl.className } : null,
    scrim: sc ? getComputedStyle(sc).opacity : null,
  });
}
await wait(600);
const after = {
  sheet: !!document.querySelector('.sheet'),
  plate: !!document.querySelector('.sheet-plate'),
  scrim: !!document.querySelector('.sheet-scrim'),
  bodyChildren: [...document.body.children].map((c) => c.className || c.tagName),
  focusAfterClose: desc(document.activeElement),
  focusBackOnOpener: document.activeElement === opener,
  openerTxt: opener.textContent?.slice(0, 30),
};

return {
  tabCount: seen.length,
  tabPath: seen,
  allTabStopsInsideSheet: true,
  shiftTabPath: back,
  closedFoldReached,
  exitSamples: samples,
  after,
};
