/**
 * 供应商槽的展开/收起全量自检：
 *   1. 展开：槽口上沿是否纹丝不动、内容是否一律朝下走
 *   2. 收起：是否正好是展开那一程的回放
 *   3. 交叠：同格的两块有没有在同时半透明（会互相穿透）
 *   4. 键盘：收起时表单不在 Tab 序列里
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (s) => document.querySelector(s);
const rect = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: +r.top.toFixed(2), bottom: +r.bottom.toFixed(2), h: +r.height.toFixed(2) };
};
const tf = (el) => {
  if (!el) return null;
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return { y: +m.f.toFixed(2), op: +getComputedStyle(el).opacity };
};
function snap() {
  return {
    slot: rect(q('.prov-slot')),
    out: rect(q('.prov-slot-out')),
    inn: rect(q('.prov-slot-in')),
    row: tf(q('.prov-slot-out > .row')),
    form: tf(q('.prov-form')),
  };
}
async function record(ms) {
  const arr = [];
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    arr.push({ t: Math.round(performance.now() - t0), ...snap() });
    await new Promise((r) => requestAnimationFrame(r));
  }
  return arr;
}
const span = (frames, key) => {
  const ts = frames.map((f) => f[key]?.top).filter((v) => v != null);
  return +(Math.max(...ts) - Math.min(...ts)).toFixed(2);
};
/** 两块同时可见即为交叠。这是「协调」与否的硬指标。 */
const overlap = (frames) => {
  const bad = frames.filter((f) => f.row.op > 0.06 && f.form.op > 0.06);
  return {
    frames: bad.length,
    total: frames.length,
    worst: bad.length
      ? +Math.max(...bad.map((f) => Math.min(f.row.op, f.form.op))).toFixed(3)
      : 0,
    sample: bad.slice(0, 3).map((f) => ({ t: f.t, rowOp: +f.row.op.toFixed(2), formOp: +f.form.op.toFixed(2) })),
  };
};

const editBtn = [...document.querySelectorAll('.btn')].find((b) => /编辑|EDIT/i.test(b.textContent));
if (!editBtn) return { error: 'no edit button' };

const baseForm = tf(q('.prov-form'));
editBtn.click();
const opening = await record(460);
const opened = snap();
const cancelBtn = [...document.querySelectorAll('.prov-form .btn')].find((b) => /取消|CANCEL/i.test(b.textContent));
if (!cancelBtn) return { error: 'no cancel button' };
cancelBtn.click();
const closing = await record(460);
const reclosed = snap();
// 收起后再点开一次，确认来回两趟都稳定
editBtn.click();
await sleep(500);
const reopened = snap();
cancelBtn.click();
await sleep(500);
const refinal = snap();

return {
  baseForm,
  opened,
  reclosed,
  reopened,
  refinal,
  opening: {
    slotTopSpan: span(opening, 'slot'),
    innTopSpan: span(opening, 'inn'),
    innFirstTop: opening[1]?.inn?.top,
    rowY: [opening[1]?.row?.y, opening[Math.floor(opening.length / 2)]?.row?.y, opening[opening.length - 1]?.row?.y],
    formY: [opening[1]?.form?.y, opening[Math.floor(opening.length / 2)]?.form?.y, opening[opening.length - 1]?.form?.y],
    overlap: overlap(opening),
  },
  closing: {
    slotTopSpan: span(closing, 'slot'),
    innTopSpan: span(closing, 'inn'),
    rowY: [closing[1]?.row?.y, closing[Math.floor(closing.length / 2)]?.row?.y, closing[closing.length - 1]?.row?.y],
    formY: [closing[1]?.form?.y, closing[Math.floor(closing.length / 2)]?.form?.y, closing[closing.length - 1]?.form?.y],
    overlap: overlap(closing),
  },
};
