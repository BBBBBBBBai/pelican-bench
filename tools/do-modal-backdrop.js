// 点击面板外面的留白应该收起弹窗；按在面板上拖动不应该误关。
// 用 `--do=` 调用。
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};

document.querySelector('.ch:not(.live)').click();
await wait(1300);

const plate = document.querySelector('.sheet-plate');
const sheet = document.querySelector('.sheet');
const pr = plate.getBoundingClientRect();
const sr = sheet.getBoundingClientRect();
out.geometry = {
  plate: { x: pr.x, y: pr.y, w: pr.width, h: pr.height },
  sheet: { x: sr.x, y: sr.y, w: sr.width, h: sr.height },
  marginTop: sr.y - pr.y,
  marginLeft: sr.x - pr.x,
  marginBottom: pr.bottom - sr.bottom,
};

// 面板内部按一下，不能关
const inner = sheet.querySelector('.sheet-head');
inner.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
await wait(220);
out.innerPressKeepsOpen = !!document.querySelector('.sheet');

// 面板外面（顶部留白）按一下，应该关
const ev = new MouseEvent('mousedown', {
  bubbles: true,
  clientX: pr.x + pr.width / 2,
  clientY: pr.y + Math.max(2, out.geometry.marginTop / 2),
});
plate.dispatchEvent(ev);
await wait(700);
out.backdropCloses = !document.querySelector('.sheet');
out.plateGone = !document.querySelector('.sheet-plate');
out.scrimGone = !document.querySelector('.sheet-scrim');
out.bodyChildren = [...document.body.children].map((c) => c.className || c.tagName);

return out;
