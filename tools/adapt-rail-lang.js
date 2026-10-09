/* 英文界面 + 展开筛选：摘要行会不会溢出、横杆展开后按钮还在不在视野里。
   顺带把 rail 点开并滚到画廊，量一次「展开的横杆会不会盖住第一格」。 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const px = (v) => Math.round(v * 10) / 10;
const q = (s) => document.querySelector(s);
const out = { lang: document.documentElement.lang };

const lineGeom = () => {
  const l = q('.rail-line');
  const cur = q('.rail-cur');
  const r = l.getBoundingClientRect();
  return {
    lineH: px(r.height),
    lineW: px(r.width),
    lineScrollW: l.scrollWidth,
    lineOverflows: l.scrollWidth > l.clientWidth + 1,
    cur: cur?.textContent?.trim() ?? null,
    curW: cur ? px(cur.getBoundingClientRect().width) : null,
    curScrollW: cur ? cur.scrollWidth : null,
    curClipped: cur ? cur.scrollWidth > cur.clientWidth + 1 : null,
    toggle: q('.rail-toggle')?.textContent?.trim() ?? null,
    toggleW: q('.rail-toggle') ? px(q('.rail-toggle').getBoundingClientRect().width) : null,
    read: q('.rail-line .read')?.textContent?.trim() ?? null,
    docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
};

out.zh = lineGeom();

// 切英文
const en = [...document.querySelectorAll('.sw > button')].find((b) => b.textContent.trim() === 'EN');
en?.click();
await sleep(1400);
out.langAfter = document.documentElement.lang;
out.en = lineGeom();

// 英文下把横杆点开
q('.rail-toggle').click();
await sleep(500);
out.enOpen = { ...lineGeom(), railH: px(q('.rail').getBoundingClientRect().height), fullH: px(q('.rail-full').getBoundingClientRect().height) };
out.enDetents = [...document.querySelectorAll('.detents > button')].map((b) => ({ t: b.textContent.trim(), w: px(b.getBoundingClientRect().width), h: px(b.getBoundingClientRect().height) }));
// 展开时横杆有没有横向溢出
out.railOpenOverflowX = q('.rail').scrollWidth > q('.rail').clientWidth + 1;

// 收回，换回中文
q('.rail-toggle').click();
await sleep(400);
const zh = [...document.querySelectorAll('.sw > button')].find((b) => b.textContent.trim() === '中');
zh?.click();
await sleep(1200);
out.zhBack = { lang: document.documentElement.lang, ...lineGeom() };
return out;
