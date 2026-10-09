// --do 文件：在「减少动态效果」下量供应商槽。
// 要证明的是：位移没了、高度不再插值，但「谁在台面上」这件事照样说得清。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const px = (v) => Math.round(v * 10) / 10;
const t = (el) => {
  const cs = getComputedStyle(el);
  return {
    prop: cs.transitionProperty,
    dur: cs.transitionDuration,
    tf: cs.transform,
    anim: cs.animationDuration,
  };
};

const slot = document.querySelector('.prov-slot');
if (!slot) return { error: 'no .prov-slot' };
const out = slot.querySelector('.prov-slot-out');
const inn = slot.querySelector('.prov-slot-in');
const form = slot.querySelector('.prov-form');
const row = slot.querySelector('.prov-slot-out > .row');
const nextSec = [...document.querySelectorAll('.bay-section')][1];

const firstSlot = document.querySelector('.roster .slot');
if (firstSlot) firstSlot.click();
await sleep(120);
const addBtn = [...document.querySelectorAll('.bay-head button')].find((b) => b.textContent.trim() === '新建');
if (!addBtn) return { error: 'no 新建 button' };

const media = matchMedia('(prefers-reduced-motion: reduce)').matches;

slot.scrollIntoView({ block: 'center' });
await sleep(250);
const before = {
  slotH: px(slot.getBoundingClientRect().height),
  outH: px(out.getBoundingClientRect().height),
  innH: px(inn.getBoundingClientRect().height),
  outVis: getComputedStyle(out).visibility,
  innVis: getComputedStyle(inn).visibility,
  formOpacity: getComputedStyle(form).opacity,
  formTf: getComputedStyle(form).transform,
};
const styles = {
  slot: t(slot),
  out: t(out),
  inn: t(inn),
  form: t(form),
  row: t(row),
};

addBtn.click();
// 位移没了以后，状态切换就该是「几乎立刻」。留 400ms 足够看清楚，
// 留不够的话量到的是过渡中而不是终态。
await sleep(400);
const after = {
  slotH: px(slot.getBoundingClientRect().height),
  outH: px(out.getBoundingClientRect().height),
  innH: px(inn.getBoundingClientRect().height),
  outVis: getComputedStyle(out).visibility,
  innVis: getComputedStyle(inn).visibility,
  formOpacity: getComputedStyle(form).opacity,
  formTf: getComputedStyle(form).transform,
  nextTop: px(nextSec.getBoundingClientRect().top),
};

// 关键断言：位移必须是 none —— 也就是说「慢慢长高」这件事真的没了。
const settled = {
  slotGrewInstantly: after.slotH > before.slotH + 200,
  formShiftedGone: after.formTf === 'none',
  outShiftedGone: getComputedStyle(row).transform === 'none',
  // 状态本身还在：按钮让位、表单上台、不透明度和可见性都翻过去了
  stateStillReadable:
    after.innVis === 'visible' &&
    after.outVis === 'hidden' &&
    after.formOpacity === '1' &&
    before.formOpacity === '0',
};

return { mediaReduced: media, styles, before, after, settled };
