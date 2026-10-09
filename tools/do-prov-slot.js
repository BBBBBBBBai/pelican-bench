// --do 文件：量「新建 / 编辑供应商」这条槽的开合。
// edge-cdp.mjs 会再包一层 async，所以这里直接写语句，不要自带 wrapper。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const px = (v) => Math.round(v * 10) / 10;
const box = (el) => {
  const r = el.getBoundingClientRect();
  return { top: px(r.top), h: px(r.height) };
};

const slot = document.querySelector('.prov-slot');
if (!slot) return { error: 'no .prov-slot' };
const out = slot.querySelector('.prov-slot-out');
const inn = slot.querySelector('.prov-slot-in');
const form = slot.querySelector('.prov-form');
const row = slot.querySelector('.prov-slot-out > .row');
const nextSec = [...document.querySelectorAll('.bay-section')][1];

// 名册里先选一家，这样「编辑供应商」才在
const firstSlot = document.querySelector('.roster .slot');
if (firstSlot) firstSlot.click();
await sleep(120);

const addBtn = [...document.querySelectorAll('.bay-head button')].find(
  (b) => b.textContent.trim() === '新建',
);
const editBtn = [...document.querySelectorAll('.prov-slot-out button')].find(
  (b) => b.textContent.trim() === '编辑供应商',
);
if (!addBtn) return { error: 'no 新建 button' };

const snap = (tag) => ({
  tag,
  slotH: px(slot.getBoundingClientRect().height),
  outH: px(out.getBoundingClientRect().height),
  innH: px(inn.getBoundingClientRect().height),
  formH: form ? px(form.getBoundingClientRect().height) : null,
  formOpacity: form ? getComputedStyle(form).opacity : null,
  formShift: form ? getComputedStyle(form).transform : null,
  outOpacity: row ? getComputedStyle(row).opacity : null,
  slotVis: getComputedStyle(slot).visibility,
  innVis: getComputedStyle(inn).visibility,
  nextTop: px(nextSec.getBoundingClientRect().top),
});

// ── 焦点可达性：关着的时候按 Tab 会不会掉进看不见的表单里 ────────────────
const reachable = (root) => {
  const seen = [];
  for (const el of root.querySelectorAll('input, select, button, textarea')) {
    if (getComputedStyle(el).visibility !== 'hidden') seen.push(el.id || el.tagName.toLowerCase());
  }
  return seen;
};

slot.scrollIntoView({ block: 'center' });
await sleep(300);
const closed = snap('closed');
const closedOutReach = reachable(out); // 常态下「编辑 / 删除」的在场证明

// ── 开：逐帧采样，看高度是不是真在插值、下一段有没有被弹一下 ─────────────
const frames = [];
const t0 = performance.now();
addBtn.click();
await new Promise((done) => {
  const tick = () => {
    frames.push([px(performance.now() - t0), px(slot.getBoundingClientRect().height), px(nextSec.getBoundingClientRect().top)]);
    if (performance.now() - t0 < 600) requestAnimationFrame(tick);
    else done();
  };
  requestAnimationFrame(tick);
});
await sleep(200);
const open = snap('open');

// ── 焦点可达性断言在整段里都用得到，见上文 reachable ────────────────────
const openReach = reachable(inn);
// 反向断言：开着的时候那一排「编辑 / 删除」要让位，且两边的可达集永远不相交。
// 上次的 bug 就藏在这里——关闭态下「编辑 / 删除」被一起藏掉了，只量表单量不出来。
const outReachOpen = reachable(out);

// 关回来，量一次（也验一次「取消」真的收得回去）
const cancelBtn = [...form.querySelectorAll('button')].find((b) => b.textContent.trim() === '取消');
cancelBtn.click();
const closeFrames = [];
const t1 = performance.now();
await new Promise((done) => {
  const tick = () => {
    closeFrames.push([px(performance.now() - t1), px(slot.getBoundingClientRect().height), px(nextSec.getBoundingClientRect().top)]);
    if (performance.now() - t1 < 600) requestAnimationFrame(tick);
    else done();
  };
  requestAnimationFrame(tick);
});
await sleep(200);
const reclosed = snap('reclosed');
const closedReach = reachable(inn);
const outReachClosed = reachable(out);

// 表单在关着时确实在树里（常驻），只是不可见
const formInTree = document.body.contains(form);

return {
  closed,
  open,
  reclosed,
  formInTree,
  openReach,
  closedReach,
  // 常态下「编辑 / 删除」在场、表单不在场；展开后两边对调。恒有一边可见、
  // 两边永不同时可见——这条就是上次那个 bug（常态下按钮被一起藏掉）的回归断言。
  outReachClosed,
  outReachOpen,
  allButtonsVisible: closedOutReach.length, // 应当是 2：编辑 + 删除
  exclusive:
    closedOutReach.length > 0 &&
    closedReach.length === 0 &&
    openReach.length > 0 &&
    outReachOpen.length === 0,
  // 高度轨迹：去重成拐点，看是不是单调插值而不是瞬移
  openPath: frames.filter((f, i) => i === 0 || f[1] !== frames[i - 1][1]).slice(0, 24),
  openSpan: px(frames[frames.length - 1][0]),
  closePath: closeFrames.filter((f, i) => i === 0 || f[1] !== closeFrames[i - 1][1]).slice(0, 24),
  // 下一段在整段过渡里的极值——单调就说明没有先顶上去再推下来
  nextTopRangeOnOpen: [Math.min(...frames.map((f) => f[2])), Math.max(...frames.map((f) => f[2]))],
  nextTopRangeOnClose: [Math.min(...closeFrames.map((f) => f[2])), Math.max(...closeFrames.map((f) => f[2]))],
  overlayX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
};
