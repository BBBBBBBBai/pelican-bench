// 决定性测试：把「第 01 条」格子里那张图绘进 canvas，采样四角像素。
// 角上 alpha=0 → 背景矩形还带圆角；角上是实色 → 直角。
// 用 .ch-no 精确定位到目标记录，不要用 querySelector('.ch-plate img') 撞运气。
const cells = [...document.querySelectorAll('.ch')];
let target = null;
for (const c of cells) {
  const no = (c.querySelector('.ch-no')?.textContent || '').trim();
  if (no === '第 01 条' || no === 'CH 01') { target = c; break; }
}
if (!target) return { found: false, nos: cells.map((c) => (c.querySelector('.ch-no')?.textContent || '').trim()) };

const img = target.querySelector('.ch-plate img');
if (!img) return { found: true, hasImg: false, isBroken: !!target.querySelector('.ch-plate .broken') };

if (!img.complete || !img.naturalWidth) {
  await new Promise((r) => img.addEventListener('load', r, { once: true }));
  await new Promise((r) => setTimeout(r, 150));
}

const w = img.naturalWidth;
const h = img.naturalHeight;
const c = document.createElement('canvas');
c.width = w;
c.height = h;
const ctx = c.getContext('2d');
let tainted = null;
try {
  ctx.drawImage(img, 0, 0);
  ctx.getImageData(0, 0, 1, 1);
} catch (e) { tainted = String(e); }

const px = (x, y) => (tainted ? null : Array.from(ctx.getImageData(x, y, 1, 1).data));

// 沿上边缘横向扫描，找出第一个不透明像素的 x —— 圆角的话它应该 > 0
let firstOpaqueX = null;
if (!tainted) {
  for (let x = 0; x < Math.min(w, 120); x++) {
    if (ctx.getImageData(x, 1, 1, 1).data[3] > 0) { firstOpaqueX = x; break; }
  }
}

return {
  found: true,
  src: img.getAttribute('src'),
  natural: [w, h],
  rendered: [img.clientWidth, img.clientHeight],
  tainted,
  corner_tl: px(1, 1),
  corner_tr: px(w - 2, 1),
  corner_bl: px(1, h - 2),
  corner_br: px(w - 2, h - 2),
  center: px(Math.floor(w / 2), Math.floor(h / 2)),
  firstOpaqueX_onRow1: firstOpaqueX,
};
