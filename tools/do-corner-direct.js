// 同源直测：把服务端真正吐出的 SVG 加载成 Image，绘进 canvas，采样四角 alpha。
// 绕开机架懒加载和 .broken 分支，直接问「这条路由返回的字节渲染出来是直角还是圆角」。
const ids = [
  '20261007-003452-wwxim',
  '20261007-170905-83ev2',
  '20261007-040652-adian',
];
const out = [];
for (const id of ids) {
  const url = `/api/records/${id}/svg`;
  const img = new Image();
  const res = await fetch(url);
  const text = await res.text();
  const rects = [...text.matchAll(/<rect\b[^>]*>/gi)].map((m) => m[0]);
  const rectsWithRx = rects.filter((r) => /\br[x|y]\b/i.test(r));
  const allRx = [...text.matchAll(/\brx\s*=\s*"[^"]*"/gi)].map((m) => m[0]);
  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
    img.src = url;
  });
  const rec = {
    id,
    status: res.status,
    bytes: text.length,
    rects,
    rectsWithRx,
    allRx,
    natural: [img.naturalWidth, img.naturalHeight],
  };
  if (img.naturalWidth) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const a = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    rec.corners = {
      tl: a(0, 0),
      tr: a(img.naturalWidth - 1, 0),
      bl: a(0, img.naturalHeight - 1),
      br: a(img.naturalWidth - 1, img.naturalHeight - 1),
      center: a(img.naturalWidth >> 1, img.naturalHeight >> 1),
      inset8: a(8, 8),
    };
  }
  out.push(rec);
}
return { out };
