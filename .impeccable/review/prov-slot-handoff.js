/**
 * 只读两条不透明度曲线：按钮那条（该让开）和表单那条（该接上）。
 * 判据是「交接处有没有一起半透明的帧」——同格两块重叠就会互相穿透。
 */
const q = (s) => document.querySelector(s);
const op = (el) => +getComputedStyle(el).opacity;
const y = (el) => +new DOMMatrixReadOnly(getComputedStyle(el).transform).f.toFixed(2);

const btn = [...document.querySelectorAll('.btn')].find((b) => /编辑|EDIT/i.test(b.textContent));
const row = q('.prov-slot-out > .row');
const form = q('.prov-form');

const samples = [];
const t0 = performance.now();
btn.click();
while (performance.now() - t0 < 420) {
  samples.push({
    t: Math.round(performance.now() - t0),
    rowOp: +op(row).toFixed(3),
    rowY: y(row),
    formOp: +op(form).toFixed(3),
    formY: y(form),
  });
  await new Promise((r) => requestAnimationFrame(r));
}

// 交接区：两块都还有可见度的那几帧
const handoff = samples.filter((s) => s.rowOp > 0.02 && s.formOp > 0.02);
const rowGone = samples.find((s) => s.rowOp <= 0.02);
const formStart = samples.find((s) => s.formOp > 0.02);
const worst = handoff.length
  ? handoff.reduce((a, b) => (Math.min(a.rowOp, a.formOp) > Math.min(b.rowOp, b.formOp) ? b : a))
  : null;

return {
  rowGoneAt: rowGone?.t ?? null,
  formStartAt: formStart?.t ?? null,
  handoffFrames: handoff.length,
  worstOverlap: worst ? { t: worst.t, rowOp: worst.rowOp, formOp: worst.formOp, sum: +(worst.rowOp + worst.formOp).toFixed(3) } : null,
  curve: samples.filter((_, i) => i % 3 === 0).map((s) => `${s.t}|${s.rowOp.toFixed(2)}|${s.formOp.toFixed(2)}|${s.rowY}|${s.formY}`),
};
