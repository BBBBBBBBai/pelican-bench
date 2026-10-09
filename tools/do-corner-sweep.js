// 全机架缩略图扫掠：把每张 .ch-plate img 绘进 canvas，沿上边缘找第一个不透明像素。
// 圆角的话首个不透明像素会明显右移（rx=32 在 264px 宽的格子里 ≈ 10px）。
// 返回每条记录的 no/when/src/首个不透明 x/四角 alpha。
const imgs = [...document.querySelectorAll('.ch')].map((cell) => {
  const img = cell.querySelector('.ch-plate img');
  return {
    no: (cell.querySelector('.ch-no')?.textContent || '').trim(),
    when: (cell.querySelector('.ch-when')?.textContent || '').trim(),
    img,
  };
});

const out = [];
for (const it of imgs) {
  if (!it.img) {
    out.push({ no: it.no, when: it.when, hasImg: false });
    continue;
  }
  const img = it.img;
  if (!img.complete || !img.naturalWidth) {
    await new Promise((r) => {
      img.addEventListener('load', r, { once: true });
      img.addEventListener('error', r, { once: true });
      setTimeout(r, 1200);
    });
  }
  if (!img.naturalWidth) {
    out.push({ no: it.no, when: it.when, hasImg: true, loaded: false, src: img.getAttribute('src') });
    continue;
  }
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  let tainted = false;
  try { ctx.drawImage(img, 0, 0); ctx.getImageData(0, 0, 1, 1); } catch { tainted = true; }
  if (tainted) { out.push({ no: it.no, when: it.when, tainted: true }); continue; }

  let firstOpaqueX = null;
  for (let x = 0; x < Math.min(w, 200); x++) {
    if (ctx.getImageData(x, 1, 1, 1).data[3] > 0) { firstOpaqueX = x; break; }
  }
  const a = (x, y) => ctx.getImageData(x, y, 1, 1).data[3];
  out.push({
    no: it.no,
    when: it.when,
    src: img.getAttribute('src'),
    natural: [w, h],
    rendered: [img.clientWidth, img.clientHeight],
    firstOpaqueX_row1: firstOpaqueX,
    alpha: { tl: a(1, 1), tr: a(w - 2, 1), bl: a(1, h - 2), br: a(w - 2, h - 2), center: a(Math.floor(w / 2), Math.floor(h / 2)) },
  });
}

// 只回报「可疑的」与一份紧凑清单，避免把 27 条全量 JSON 刷进日志
return {
  count: out.length,
  suspicious: out.filter((o) => typeof o.firstOpaqueX_row1 === 'number' && o.firstOpaqueX_row1 > 2),
  compact: out.map((o) => ({
    no: o.no,
    when: o.when,
    x: o.firstOpaqueX_row1 !== undefined ? o.firstOpaqueX_row1 : (o.tainted ? 'tainted' : (o.hasImg === false ? 'noimg' : 'unloaded')),
    nat: o.natural,
    src: o.src,
  })),
};
