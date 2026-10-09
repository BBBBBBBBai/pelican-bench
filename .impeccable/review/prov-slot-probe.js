/**
 * 量「供应商编辑/新建」槽的展开动画方向。
 * 不看截图，只读几何：谁在往上走、谁在往下走。
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const q = (s) => document.querySelector(s);
const rect = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: +r.top.toFixed(2), bottom: +r.bottom.toFixed(2), h: +r.height.toFixed(2) };
};
const ty = (el) => {
  if (!el) return null;
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return { y: +m.f.toFixed(2), op: +getComputedStyle(el).opacity };
};

function snap(t) {
  const out = q('.prov-slot-out');
  const inn = q('.prov-slot-in');
  const row = q('.prov-slot-out > .row');
  const form = q('.prov-form');
  return {
    t: Math.round(t),
    slot: rect(q('.prov-slot')),
    out: rect(out),
    inn: rect(inn),
    rowY: ty(row),
    formY: ty(form),
  };
}

const out = [];
const t0 = performance.now();
const tick = () => {
  out.push(snap(performance.now() - t0));
  if (performance.now() - t0 < 600) requestAnimationFrame(tick);
};

const btn = [...document.querySelectorAll('.btn')].find((b) => /编辑|EDIT/i.test(b.textContent));
if (!btn) return { error: '没找到「编辑供应商」按钮', buttons: [...document.querySelectorAll('.btn')].map((b) => b.textContent.trim()) };

const before = snap(0);
requestAnimationFrame(tick);
btn.click();
await sleep(750);
const after = snap(0);

return {
  before,
  after,
  frames: out.filter((_, i) => i % 2 === 0),
};
