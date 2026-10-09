/**
 * 静态留档：展开后停稳的那一帧，和收起时的常态。
 * 用于对比「两张纸有没有对在同一条上沿上」。
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const btn = [...document.querySelectorAll('.btn')].find((b) => /编辑|EDIT/i.test(b.textContent));
btn.click();
await sleep(900);
const slots = document.querySelector('.prov-slot').getBoundingClientRect();
// 滚到槽口，好让截图取到它
document.querySelector('.prov-slot').scrollIntoView({ block: 'center' });
await sleep(400);
return { settled: true, slotHeight: Math.round(slots.height) };
