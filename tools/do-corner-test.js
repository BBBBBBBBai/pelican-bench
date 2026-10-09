// 决定性测试：把格子里那张图绘进 canvas，直接采样四角像素。
// 如果角上是透明（alpha 0），说明背景矩形带圆角；如果是背景色，说明是直角。
const img = document.querySelector('.ch-plate img');
if (!img) return { found: false, note: 'no .ch-plate img on page' };

if (!img.complete) {
  await new Promise((r) => img.addEventListener('load', r, { once: true }));
  await new Promise((r) => setTimeout(r, 120));
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
} catch (e) {
  tainted = String(e);
}

const px = (x, y) => {
  if (tainted) return null;
  return Array.from(ctx.getImageData(x, y, 1, 1).data);
};

return {
  src: img.getAttribute('src'),
  natural: [w, h],
  rendered: [img.clientWidth, img.clientHeight],
  tainted,
  corner_tl: px(1, 1),
  corner_tr: px(w - 2, 1),
  corner_bl: px(1, h - 2),
  corner_br: px(w - 2, h - 2),
  center: px(Math.floor(w / 2), Math.floor(h / 2)),
};
