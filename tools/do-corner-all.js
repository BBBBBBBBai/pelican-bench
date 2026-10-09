// 一次性判定：把机架里每一张 .ch-plate img 绘进 canvas，采样四角 alpha。
// 角上 alpha=0（透明）= 背景矩形还带圆角；角上是实色 = 直角。
// 注意：本来就没有满幅背景矩形的作品，四角天然透明，属于正常，需结合 src 判断。
const imgs = [...document.querySelectorAll('.ch-plate img')];
const out = [];
for (const img of imgs) {
  const cell = img.closest('.ch');
  const no = (cell?.querySelector('.ch-no')?.textContent || '').trim();
  const animal = (cell?.querySelector('.ch-animal')?.textContent || '').trim();
  if (!img.complete || !img.naturalWidth) {
    await new Promise((r) => {
      img.addEventListener('load', r, { once: true });
      setTimeout(r, 500);
    });
  }
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) {
    out.push({ no, animal, src: img.getAttribute('src'), skipped: 'noNaturalSize' });
    continue;
  }
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
  const a = (x, y) => (tainted ? null : ctx.getImageData(x, y, 1, 1).data[3]);
  let firstX = null;
  if (!tainted) {
    for (let x = 0; x < Math.min(w, 80); x++) {
      if (a(x, 1) > 0) { firstX = x; break; }
    }
  }
  out.push({
    no,
    animal,
    src: img.getAttribute('src'),
    natural: [w, h],
    cornerAlpha: [a(0, 0), a(w - 1, 0), a(0, h - 1), a(w - 1, h - 1)],
    firstOpaqueX_row1: firstX,
    tainted,
  });
}
return { imgCount: out.length, out };
