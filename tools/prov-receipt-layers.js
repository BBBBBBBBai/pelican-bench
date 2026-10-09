// 窄屏上「粘住的供应商标题行」和「粘住的筛选横杆」会不会打架。
// 三块东西都想粘在顶上：busbar 在流里、rail 粘 top:0、prov-head 粘 top:0。
// 问题只有两个：谁盖谁、以及标题行粘住的那一刻它上面到底是横杆还是天花板。
//
// 用法：node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --mobile --width=390 --height=844 --touch --do=tools/prov-receipt-layers.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const byText = (sel, texts) =>
  [...document.querySelectorAll(sel)].find((el) => texts.includes(el.textContent.trim())) ?? null;
const R = (sel) => {
  const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1),
    pos: cs.position, z: cs.zIndex, bg: cs.backgroundColor,
  };
};
// 真正的滚动容器：竖屏是 html，横屏是 .panel-scroll
const scrollerOf = (el) => {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return document.documentElement;
};
const scrollBy = (sc, y) => {
  if (sc === document.documentElement) window.scrollTo(0, y);
  else sc.scrollTop = y;
};
const hitAt = (x, y) => {
  const el = document.elementFromPoint(x, y);
  return el ? `${el.tagName}.${typeof el.className === 'string' ? el.className : ''}` : null;
};

const head = document.querySelector('.prov-head');
const sc = scrollerOf(head);
const out = {
  viewport: { w: window.innerWidth, h: window.innerHeight },
  scroller: sc === document.documentElement ? 'HTML' : `${sc.tagName}.${sc.className}`,
  natural: { busbar: R('.busbar'), rail: R('.rail'), bay: R('.bay'), panel: R('.panel'), head: R(head), band: R('.rack-band') },
  steps: [],
};

byText('.bay-head button', ['新建', 'NEW']).click();
await sleep(220);
out.formOpen = { head: R(head), rail: R('.rail') };

for (const y of [200, 400, 600, 900]) {
  scrollBy(sc, y);
  await sleep(120);
  const hb = head.getBoundingClientRect();
  const rb = document.querySelector('.rail').getBoundingClientRect();
  out.steps.push({
    want: y,
    scrollY: sc === document.documentElement ? +window.scrollY.toFixed(1) : +sc.scrollTop.toFixed(1),
    head: R(head),
    rail: R('.rail'),
    band: R('.rack-band'),
    // 标题行正上方那一点（它粘在顶上时，上面是不是横杆）。
    // 取标题行自己的横坐标，不取屏幕中线 —— 横屏是两列，中线那一列站的是机架。
    aboveHead: hitAt(hb.left + hb.width / 2, Math.max(1, hb.top - 3)),
    // 标题行自己的中点，必须命中标题行（实底挡得住滚过来的东西）
    headCenter: hitAt(hb.left + hb.width / 2, hb.top + hb.height / 2),
    // 横杆与标题行有没有真的打架：要**两轴都相交**才算重叠。
    // 只比上下边是不够的：横屏两列时它们在同一个竖向坐标里，却左右分开，
    // 竖着的重叠量会报出一个吓人但毫无意义的 45px。
    overlapRail: +(
      Math.max(0, Math.min(hb.right, rb.right) - Math.max(hb.left, rb.left)) *
      Math.max(0, Math.min(hb.bottom, rb.bottom) - Math.max(hb.top, rb.top))
    ).toFixed(1),
  });
  scrollBy(sc, 0);
  await sleep(80);
}
byText('.prov-form button', ['取消', 'CANCEL']).click();
await sleep(300);
return out;
