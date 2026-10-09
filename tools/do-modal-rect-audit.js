// 弹窗路径的端到端检查：iframe 是 sandbox（跨源），父页面读不到它的 document，
// 但 srcdoc 属性是普通字符串、可读。它就是 SvgFrame 实际交给浏览器的那份文档。
// 直接看它里面的 <rect> 还有没有 rx —— 这比截图肉眼判断可靠。
const cells = [...document.querySelectorAll('.ch')];
let target = null;
for (const c of cells) {
  const no = (c.querySelector('.ch-no')?.textContent || '').trim();
  if (no === '第 01 条' || no === 'CH 01') { target = c; break; }
}
if (!target) return { found: false };

target.click();
await new Promise((r) => setTimeout(r, 1800));

const frame = document.querySelector('.plate iframe');
const doc = frame?.getAttribute('srcdoc') || '';

const rects = [...doc.matchAll(/<rect[^>]*>/gi)].map((m) => m[0]);
const allRx = [...doc.matchAll(/\brx\s*=\s*[^\s>]+/gi)].map((m) => m[0]);
// 只关心「rx 出现在 <rect> 标签里」这种情况
const rectsWithRx = rects.filter((r) => /\br[x|y]\s*=/i.test(r));

return {
  found: true,
  hasFrame: !!frame,
  srcdocLen: doc.length,
  rects,
  rectsWithRx,
  allRxInDoc: allRx,
  // SVG 根节点上的尺寸属性
  svgTag: (doc.match(/<svg[^>]*>/) || [''])[0].slice(0, 200),
};
