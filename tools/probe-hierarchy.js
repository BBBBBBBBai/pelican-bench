(async () => {
/* 层级不是靠肉眼看截图定的，是量出来的。
   对每一个「承担一个角色」的元素，取它真实的计算颜色、字号、字重、字宽轴，
   算出它相对所在面板底的对比度，再按对比度排序。
   这样能回答一个截图回答不了的问题：一格里四个角色，
   主次到底有没有拉开，还是四个都在同一个灰上。 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parse(c) {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((x) => parseFloat(x));
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}
function lum(c) {
  const f = (u) => {
    u /= 255;
    return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function ratio(a, b) {
  const la = lum(a), lb = lum(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
// 往上找第一个不透明的背景，这就是这段字真正压着的底
function bgOf(el) {
  let n = el;
  while (n && n !== document.documentElement) {
    const cs = getComputedStyle(n);
    const c = parse(cs.backgroundColor);
    if (c && c.a > 0.9) return c;
    n = n.parentElement;
  }
  return { r: 12, g: 12, b: 11, a: 1 };
}

const ROLES = [
  ['.nameplate b', '铭牌'],
  ['.nameplate span', '铭牌副'],
  ['.window .silk', '窗标签'],
  ['.window .read-lg', '窗读数'],
  ['.ch-no', '格号'],
  ['.ch-dur', '格耗时'],
  ['.ch-animal', '格主：动物'],
  ['.ch-prov', '格次：供应商'],
  ['.ch-model', '格三：模型'],
  ['.ch-when', '格三：时间'],
  ['.ch.live .ch-no', '通电格号'],
  ['.tag', '异常标签'],
  ['.bus-track .addr', '跟踪地址'],
  ['.bus-track .who', '跟踪动物'],
  ['.rack-band .addr', '带地址'],
  ['.bay-head .silk', '段落标题'],
  ['.field > label', '字段名'],
  ['.slot-name', '工位名'],
  ['.slot-sub', '工位副行'],
  ['.btn', '按钮'],
  ['.check', '勾选'],
  ['.note', '散文'],
  ['.pathline', '路径'],
  ['.facts dt', '事实名'],
  ['.facts dd', '事实值'],
  ['.empty', '空态'],
];

const rows = [];
for (const [sel, label] of ROLES) {
  const el = document.querySelector(sel);
  if (!el) continue;
  const cs = getComputedStyle(el);
  const fg = parse(cs.color);
  const bg = bgOf(el);
  const box = el.getBoundingClientRect();
  rows.push({
    label,
    sel,
    size: cs.fontSize,
    weight: cs.fontWeight,
    wdth: (cs.fontVariationSettings.match(/'wdth'\s*([\d.]+)/) || [, '—'])[1],
    family: cs.fontFamily.split(',')[0].replace(/"/g, ''),
    ls: cs.letterSpacing,
    color: `rgb(${fg.r},${fg.g},${fg.b})`,
    cr: +ratio(fg, bg).toFixed(2),
    px: +box.height.toFixed(1),
    sample: (el.textContent || '').trim().slice(0, 24),
  });
}

// 一格之内四个角色的对比度落差——这是「有没有主次」的量化答案
const cell = rows.filter((r) => r.sel.startsWith('.ch-') && !r.sel.includes('live'));
const cellSpread = cell.length
  ? {
      top: cell.reduce((a, b) => (a.cr > b.cr ? a : b)).label,
      topCr: Math.max(...cell.map((r) => r.cr)),
      bottom: cell.reduce((a, b) => (a.cr < b.cr ? a : b)).label,
      bottomCr: Math.min(...cell.map((r) => r.cr)),
      spread: +(Math.max(...cell.map((r) => r.cr)) - Math.min(...cell.map((r) => r.cr))).toFixed(2),
    }
  : null;

return { lang: document.documentElement.lang, roles: rows, cellSpread };
})()
