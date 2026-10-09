// 针对「2026-10-07 00:34」那条记录（20261007-003452-wwxim）的双路径取证：
//   A) 机架缩略图：新 profile 首次加载 → 若四角是直角，说明服务端字节本来就是直角，
//      用户看到的圆角只能来自他自己浏览器里的旧副本。
//   B) 弹窗：iframe 是 sandbox 读不到 document，但 srcdoc 属性可读，直接看 <rect> 有无 rx。
const cells = [...document.querySelectorAll('.ch')];
const target = cells.find((c) => (c.querySelector('.ch-plate img')?.getAttribute('src') || '').includes('20261007-003452-wwxim'));
if (!target) return { found: false, srcs: cells.map((c) => c.querySelector('.ch-plate img')?.getAttribute('src') || null) };

const img = target.querySelector('.ch-plate img');
const out = { found: true, src: img.getAttribute('src') };

// A) 滚进视口触发 lazy 加载，然后采样四角
img.scrollIntoView({ block: 'center' });
if (!img.complete || !img.naturalWidth) {
  await new Promise((r) => {
    img.addEventListener('load', r, { once: true });
    img.addEventListener('error', r, { once: true });
    setTimeout(r, 2500);
  });
}
const w = img.naturalWidth, h = img.naturalHeight;
out.natural = [w, h];
out.rendered = [img.clientWidth, img.clientHeight];
if (w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  try {
    ctx.drawImage(img, 0, 0);
    let firstOpaqueX = null;
    for (let x = 0; x < Math.min(w, 200); x++) {
      if (ctx.getImageData(x, 1, 1, 1).data[3] > 0) { firstOpaqueX = x; break; }
    }
    const a = (x, y) => ctx.getImageData(x, y, 1, 1).data[3];
    out.thumb = {
      firstOpaqueX_row1: firstOpaqueX,
      alpha: { tl: a(1, 1), tr: a(w - 2, 1), bl: a(1, h - 2), br: a(w - 2, h - 2), center: a((w / 2) | 0, (h / 2) | 0) },
      verdict: firstOpaqueX !== null && firstOpaqueX > 2 ? 'ROUNDED' : 'SQUARE',
    };
  } catch (e) { out.thumb = { tainted: String(e) }; }
} else {
  out.thumb = { loaded: false, broken: !!target.querySelector('.ch-plate .broken') };
}

// B) 点开弹窗，读 srcdoc
target.click();
await new Promise((r) => setTimeout(r, 1800));
const frame = document.querySelector('.plate iframe');
const doc = frame?.getAttribute('srcdoc') || '';
const rects = [...doc.matchAll(/<rect[^>]*>/gi)].map((m) => m[0]);
out.modal = {
  addr: (document.querySelector('.sheet-addr')?.textContent || '').trim(),
  hasFrame: !!frame,
  srcdocLen: doc.length,
  rects,
  rectsWithRx: rects.filter((r) => /\br[x|y]\s*=/i.test(r)),
  allRx: [...doc.matchAll(/\brx\s*=\s*"[^"]*"/gi)].map((m) => m[0]),
};
return out;
