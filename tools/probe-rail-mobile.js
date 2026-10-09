(async () => {
/* 手机上这条工具轨（供应商挡位 + 题目 + 排序 + 格子大小 + 只看异常）会折行。
   我把挡位按钮从 12.5px 提到 13.5px 是为了右侧 300px 栏里的可读性，
   但同一个按钮在 390px 上要折四行——抬高的字号会不会把机架挤没了？
   这里对比「现在」和「如果我保留旧值」两种情况下轨道的高度，
   以及机架第一格从第几像素开始。 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rail = document.querySelector('.rail');
const rackScroll = document.querySelector('.rack-scroll');
const firstCell = document.querySelector('.ch');

function snap(tag) {
  const r = rail ? rail.getBoundingClientRect() : null;
  const c = firstCell ? firstCell.getBoundingClientRect() : null;
  const detents = [...document.querySelectorAll('.detents > button')];
  // 挡位按钮占据的行数：按 top 去重
  const rows = new Set(detents.map((b) => Math.round(b.getBoundingClientRect().top))).size;
  return {
    tag,
    railH: r ? +r.height.toFixed(1) : null,
    firstCellTop: c ? +c.top.toFixed(1) : null,
    vh: window.innerHeight,
    rackVisible: c ? +(window.innerHeight - c.top).toFixed(1) : null,
    detentRows: rows,
    docOverflowX: +(document.documentElement.scrollWidth - document.documentElement.clientWidth).toFixed(1),
  };
}

const now = snap('now(13.5px)');

// 临时把挡位按钮退回旧值，再量一次
const st = document.createElement('style');
st.textContent = '.detents > button, .sw > button { font-size: 12.5px !important; }';
document.head.appendChild(st);
await sleep(250);
const old = snap('old(12.5px)');
st.remove();
await sleep(250);

// 顺带量一下最长的挡位名在 390px 下会不会被 ellipsis 吃掉
const long = [...document.querySelectorAll('.detents > button')]
  .map((b) => ({
    text: (b.textContent || '').trim(),
    w: +b.getBoundingClientRect().width.toFixed(1),
    clipped: b.scrollWidth - b.clientWidth,
    maxW: getComputedStyle(b).maxWidth,
  }))
  .filter((x) => x.text);

return { now, old, deltaRailH: +(now.railH - old.railH).toFixed(1), detents: long.slice(0, 10) };
})()
