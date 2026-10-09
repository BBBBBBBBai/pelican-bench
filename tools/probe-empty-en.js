(async () => {
/* 空态在 390px 下的英文宽度：原本这是全站最糟的一处本地化失效
   （英文提示句需要 687px，容器只有 350px）。这里真的切到 EN，
   真的把列表过滤到零条，让那个空态自己渲染出来再量。 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 切到 EN
const sw = [...document.querySelectorAll('.sw button')].find((b) => /EN/i.test(b.textContent || ''));
if (sw) {
  sw.click();
  await sleep(700);
}

// 选中一个没有异常记录的供应商，再打上「只看有异常的」→ 列表空，空态出现
const detent = [...document.querySelectorAll('.detents > button')].find((b) =>
  /原厂直连/.test(b.textContent || '')
);
if (detent) {
  detent.click();
  await sleep(400);
}
const issues = [...document.querySelectorAll('.sw button')].find((b) => /ONLY|ISSUES|异常/i.test(b.textContent || ''));
if (issues) {
  issues.click();
  await sleep(600);
}

const empties = [...document.querySelectorAll('.empty')].map((el) => {
  const silk = el.querySelector('.silk');
  const box = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  // 找最长的一行文本节点，量它的自然宽度
  let worst = null;
  for (const n of el.childNodes) {
    if (n.nodeType !== 3) continue;
    const s = n.nodeValue.trim();
    if (!s) continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    const rects = [...r.getClientRects()];
    const w = Math.max(...rects.map((x) => x.width), 0);
    if (!worst || w > worst.w) worst = { text: s.slice(0, 50), w: +w.toFixed(1), lines: rects.length };
  }
  return {
    boxW: +box.width.toFixed(1),
    padL: cs.paddingLeft,
    padR: cs.paddingRight,
    contentW: +(box.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)).toFixed(1),
    overflowX: +(el.scrollWidth - el.clientWidth).toFixed(1),
    docOverflowX: +(document.documentElement.scrollWidth - document.documentElement.clientWidth).toFixed(1),
    heading: silk
      ? {
          text: (silk.textContent || '').trim(),
          whiteSpace: getComputedStyle(silk).whiteSpace,
          w: +silk.getBoundingClientRect().width.toFixed(1),
          h: +silk.getBoundingClientRect().height.toFixed(1),
          overflow: +(silk.scrollWidth - silk.clientWidth).toFixed(1),
        }
      : null,
    longestLine: worst,
  };
});

// 空态里那个「清除筛选」按钮也要能看见
const btn = document.querySelector('.empty .btn');
const btnInfo = btn
  ? {
      text: (btn.textContent || '').trim(),
      w: +btn.getBoundingClientRect().width.toFixed(1),
      h: +btn.getBoundingClientRect().height.toFixed(1),
      overflow: +(btn.scrollWidth - btn.clientWidth).toFixed(1),
    }
  : null;

// 整页还有没有横向溢出 / 截断
const clipped = [];
for (const el of document.querySelectorAll('.rail *, .rack *, .panel *')) {
  if (el.scrollWidth > el.clientWidth + 2) {
    const cs = getComputedStyle(el);
    if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.textOverflow === 'ellipsis') continue;
    clipped.push({
      cls: el.className,
      over: el.scrollWidth - el.clientWidth,
      text: (el.textContent || '').trim().slice(0, 40),
    });
  }
}

return { lang: document.documentElement.lang, empties, btnInfo, clipped: clipped.slice(0, 12) };
})()
