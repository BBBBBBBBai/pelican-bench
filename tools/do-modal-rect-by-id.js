// 逐个「打开弹窗并审计 srcdoc」太慢，这里只针对原始 SVG 里带 `rx` 的那几条记录。
// 用机架格子的 img src 反查记录 id，再点开它，读 iframe 的 srcdoc 属性
// （iframe 是 sandbox 的，父页面读不到它的 document，但 srcdoc 是普通字符串）。
const TARGETS = (window.__TARGET_IDS__ || []).length
  ? window.__TARGET_IDS__
  : ['20261007-003452-wwxim', '20261007-170905-83ev2'];

const cells = [...document.querySelectorAll('.ch')];
const out = [];

for (const id of TARGETS) {
  const cell = cells.find((c) => {
    const img = c.querySelector('.ch-plate img');
    return img && (img.getAttribute('src') || '').includes(id);
  });
  if (!cell) { out.push({ id, found: false }); continue; }

  const no = (cell.querySelector('.ch-no')?.textContent || '').trim();
  const animal = (cell.querySelector('.ch-animal')?.textContent || '').trim();
  cell.click();
  await new Promise((r) => setTimeout(r, 1600));

  const frame = document.querySelector('.plate iframe');
  const doc = frame?.getAttribute('srcdoc') || '';
  const rects = [...doc.matchAll(/<rect\b[^>]*>/gi)].map((m) => m[0]);
  const rectsWithRx = rects.filter((r) => /\br[x|y]\b/i.test(r));

  out.push({
    id,
    no,
    animal,
    hasFrame: !!frame,
    srcdocLen: doc.length,
    rects,
    rectsWithRx,
    allRxInDoc: [...doc.matchAll(/\brx\s*=\s*"[^"]*"/gi)].map((m) => m[0]),
  });

  // 关掉，换下一条
  const closeBtn = document.querySelector('.sheet-head .btn.icon');
  if (closeBtn) closeBtn.click();
  await new Promise((r) => setTimeout(r, 600));
}

return { out };
