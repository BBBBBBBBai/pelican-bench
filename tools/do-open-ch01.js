// 打开 CH 01 那条记录的弹窗（它是唯一带 rx="32" 背景矩形的真实记录）。
const cells = [...document.querySelectorAll('.ch')];
let target = null;
for (const c of cells) {
  const no = (c.querySelector('.ch-no')?.textContent || '').trim();
  if (no === '第 01 条' || no === 'CH 01') {
    target = c;
    break;
  }
}
if (!target) {
  return { found: false, nos: cells.map((c) => (c.querySelector('.ch-no')?.textContent || '').trim()) };
}
const before = {
  no: target.querySelector('.ch-no')?.textContent,
  animal: target.querySelector('.ch-animal')?.textContent,
  hasImg: !!target.querySelector('.ch-plate img'),
  isBroken: !!target.querySelector('.ch-plate .broken'),
};
target.click();
await new Promise((r) => setTimeout(r, 1600));
const frame = document.querySelector('.plate iframe');
const plate = document.querySelector('.plate');
const fb = frame?.getBoundingClientRect();
return {
  found: true,
  before,
  addr: document.querySelector('.sheet-addr')?.textContent,
  hasIframe: !!frame,
  plate: plate ? { w: plate.clientWidth, h: plate.clientHeight } : null,
  frame: fb ? { x: Math.round(fb.x), y: Math.round(fb.y), w: Math.round(fb.width), h: Math.round(fb.height) } : null,
};
