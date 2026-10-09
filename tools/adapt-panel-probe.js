// 右栏各段内部尺寸（手机档），用来决定「开始生成」能提到多高
const px = (v) => Math.round(v * 10) / 10;
const R = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { y: px(r.y), h: px(r.height), w: px(r.width) };
};
const panel = document.querySelector('.panel');
const base = panel.getBoundingClientRect().y;
const rel = (el) => {
  const b = R(el);
  return b ? { top: px(b.y - base), h: b.h, w: b.w } : null;
};
const secs = [...document.querySelectorAll('.panel .bay-section')];
const out = {
  panelTop: px(base),
  panelH: px(panel.getBoundingClientRect().height),
  sections: secs.map((s) => ({
    head: (s.querySelector('.bay-head')?.textContent || '').trim().slice(0, 12),
    ...rel(s),
    kids: [...s.children].map((c) => ({
      cls: String(c.className).slice(0, 24),
      top: rel(c).top,
      h: rel(c).h,
    })),
  })),
  runKids: [...secs[1].querySelectorAll(':scope > *')].map((c) => ({
    cls: String(c.className).slice(0, 26),
    ...rel(c),
  })),
  runDeep: [...secs[1].querySelectorAll('.field, .model-pick > *, .fold, .note, dl, .btn')].map((c) => ({
    cls: String(c.className).slice(0, 26),
    ...rel(c),
  })),
  mpGrid: rel(document.querySelector('.mp-grid')),
  mpCell: rel(document.querySelector('.mp-cell')),
  startBtn: rel(document.querySelector('.btn.arm')),
};
return out;
