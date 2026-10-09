(async () => {
/* 检测同一条文本里相邻字符是否画在了彼此身上。
   letter-spacing 是加在每个字形之后的，但 CJK 回退、variation-settings
   和 text-rendering 都可能让引擎把两个字形摆到同一个 x 上——肉眼在小字号下
   只会觉得「这行有点糊」，量出来才知道是真的叠了。 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 打开第一张有画的标本页
const cell = [...document.querySelectorAll('.ch')].find((c) => c.querySelector('.ch-plate img'));
if (cell) {
  cell.click();
  await sleep(1400);
}

function overlaps(el) {
  const out = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const s = n.nodeValue;
    if (!s || !s.trim()) continue;
    const r = document.createRange();
    let prev = null;
    for (let i = 0; i < s.length; i++) {
      if (!s[i].trim()) {
        prev = null;
        continue;
      }
      r.setStart(n, i);
      r.setEnd(n, i + 1);
      const b = r.getBoundingClientRect();
      if (b.width === 0) continue;
      if (prev && b.left < prev.right - 0.6) {
        out.push({
          text: s.slice(Math.max(0, i - 4), i + 5),
          at: i,
          ch: s[i],
          prevRight: +prev.right.toFixed(2),
          thisLeft: +b.left.toFixed(2),
          overlap: +(prev.right - b.left).toFixed(2),
        });
      }
      prev = b;
    }
  }
  return out;
}

const targets = [
  '.prompt-line',
  '.note',
  '.silk',
  '.silk-plain',
  '.ch-animal',
  '.ch-prov',
  '.stream',
  '.sheet-addr',
  '.facts dd',
];

const report = {};
for (const sel of targets) {
  const found = [];
  for (const el of document.querySelectorAll(sel)) {
    const o = overlaps(el);
    if (o.length) {
      found.push({
        cls: el.className,
        preview: (el.textContent || '').trim().slice(0, 60),
        style: {
          fs: getComputedStyle(el).fontSize,
          ls: getComputedStyle(el).letterSpacing,
          ff: getComputedStyle(el).fontFamily.split(',')[0],
        },
        overlaps: o.slice(0, 6),
        count: o.length,
      });
    }
  }
  if (found.length) report[sel] = found;
}

// 顺带确认标本页里那行题目到底怎么排的
const pl = document.querySelector('.prompt-line');
report._promptLine = pl
  ? {
      text: pl.textContent.trim().slice(0, 80),
      childCount: pl.children.length,
      cs: (({ fontSize, letterSpacing, fontFamily, lineHeight, wordSpacing, textRendering }) => ({
        fontSize,
        letterSpacing,
        fontFamily,
        lineHeight,
        wordSpacing,
        textRendering,
      }))(getComputedStyle(pl)),
      rect: (({ width, height }) => ({ w: +width.toFixed(1), h: +height.toFixed(1) }))(
        pl.getBoundingClientRect()
      ),
    }
  : null;

report._overlapTotal = Object.values(report)
  .filter(Array.isArray)
  .reduce((a, v) => a + v.reduce((b, x) => b + x.count, 0), 0);

return report;
})()
