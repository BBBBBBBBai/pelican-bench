/* 摘要行必须自己说清「现在筛的是什么」。这里真的改几个条件，看它怎么变。 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const px = (v) => Math.round(v * 10) / 10;
const q = (s) => document.querySelector(s);
const sum = () => {
  const cur = q('.rail-cur');
  return {
    cur: cur.textContent.trim(),
    curClipped: cur.scrollWidth > cur.clientWidth + 1,
    railH: px(q('.rail').getBoundingClientRect().height),
    shown: q('.rail-line .read')?.textContent?.trim() ?? null,
    cells: document.querySelectorAll('.ch').length,
  };
};
const out = { initial: sum() };

const clickText = async (sel, text) => {
  const el = [...document.querySelectorAll(sel)].find((b) => b.textContent.trim() === text);
  if (!el) return false;
  el.click();
  await sleep(500);
  return true;
};

// 供应商：挑一个非默认挡位
out.pickedProvider = await clickText('.detents > button', '北方中转');
out.afterProvider = sum();

// 排序换旧的
out.pickedOld = await clickText('.rail-group .sw > button', '旧的在前');
out.afterOld = sum();

// 格子大小：密
out.pickedDense = await clickText('.rail-group .sw > button', '小');
out.afterDense = sum();

// 只看异常
out.pickedIssues = await clickText('.rail-full > .sw > button', '只看有异常的');
out.afterIssues = sum();

// 全开之后把横杆摊开，摘要会不会被挤掉
q('.rail-toggle').click();
await sleep(450);
out.open = { ...sum(), railH: px(q('.rail').getBoundingClientRect().height) };
out.toggleText = q('.rail-toggle').textContent.trim();

// 复位
const reset = [...document.querySelectorAll('.btn.quiet')].find((b) => /重置|RESET/i.test(b.textContent));
out.resetFound = Boolean(reset);
reset?.click();
await sleep(600);
out.afterReset = sum();
return out;
