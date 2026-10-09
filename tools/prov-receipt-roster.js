// 手机竖屏（整页滚，控制台在机架之前）里，名册有 N 家供应商时会怎样：
// 「保存」键被推下去多少、要滚多少才够得着、滚到那儿之后「供应商」标题行还在不在视野里。
// 回执要留在标题行里（桌面端同款样式），标题行就必须在按下去的那一刻看得见。
//
// 名册长度是唯一的变量，而现有档案不能动 —— 所以这里**只克隆 `.slot` 节点来量高度**，
// 不碰数据、不点任何会改配置的键。克隆出来的东西量完随手删掉。
//
// 用法：node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --width=390 --height=844 --mobile --touch --do=tools/prov-receipt-roster.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const byText = (sel, texts) =>
  [...document.querySelectorAll(sel)].find((el) => texts.includes(el.textContent.trim())) ?? null;
const R = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1) };
};
// 「按保存的那一刻」最坏情况：保存键的下沿刚进视野，一 px 都不多滚
const scrollerOf = (el) => {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return document.documentElement;
};

const head = document.querySelector('.bay-section .bay-head');
const roster = document.querySelector('.roster');
const realSlots = [...roster.querySelectorAll('.slot')];
const out = { viewport: { w: window.innerWidth, h: window.innerHeight }, realCount: realSlots.length, rows: [] };

byText('.bay-head button', ['新建', 'NEW']).click();
await sleep(220);

for (const n of [1, 2, 3, 4, 6, 8, 12]) {
  // 补齐到 n 个格子。**只删带 `data-probe-clone` 的克隆**，绝不碰 React 管的真节点
  // （真节点被移走会让 React 之后的对账崩掉）。
  const clones = () => [...roster.querySelectorAll('.slot[data-probe-clone]')];
  while (roster.querySelectorAll('.slot').length > n) {
    const c = clones();
    if (!c.length) break; // 已经只剩真节点了，不再往下裁
    c[c.length - 1].remove();
  }
  while (roster.querySelectorAll('.slot').length < n) {
    const c = roster.querySelectorAll('.slot')[0].cloneNode(true);
    c.setAttribute('data-probe-clone', '');
    roster.appendChild(c);
  }
  await sleep(30);

  const submit = document.querySelector('.prov-form button[type="submit"]');
  const sc = scrollerOf(submit);
  const isDoc = sc === document.documentElement;
  const scBottom = isDoc ? window.innerHeight : sc.getBoundingClientRect().bottom;
  const scTop0 = isDoc ? window.scrollY : sc.scrollTop;
  const need = Math.max(0, submit.getBoundingClientRect().bottom - scBottom);
  if (isDoc) window.scrollTo(0, scTop0 + need);
  else sc.scrollTop += need;
  await sleep(120);

  const hb = head.getBoundingClientRect();
  out.rows.push({
    n,
    scroller: isDoc ? 'HTML' : `${sc.tagName}.${sc.className}`,
    need: +need.toFixed(1),
    submitBottom: +submit.getBoundingClientRect().bottom.toFixed(1),
    head: R(head),
    // 标题行整个还在视野里吗（这就是回执留在标题行里能不能被看见）
    headFullyOnScreen: hb.top >= 0 && hb.bottom <= window.innerHeight,
    headTopVisible: hb.top >= 0,
    // 还有多少余量：再往下滚多少 px 标题行才整个出顶
    slackBeforeHeadLost: +hb.bottom.toFixed(1),
  });
  // 复位，量下一档
  if (isDoc) window.scrollTo(0, scTop0);
  else sc.scrollTop = scTop0;
  await sleep(60);
}

// 还原名册：把克隆全删掉，真节点一根汗毛都没动过
roster.querySelectorAll('.slot[data-probe-clone]').forEach((s) => s.remove());
byText('.prov-form button', ['取消', 'CANCEL']).click();
await sleep(400);
out.headInTree = Boolean(document.querySelector('.bay-section .bay-head'));
out.rosterAfter = roster.querySelectorAll('.slot').length;
return out;
