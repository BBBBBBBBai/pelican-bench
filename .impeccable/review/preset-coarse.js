// --do 文件：粗指针下每一格是否都够 44px 的落点（--mobile --touch 时跑）。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
document.querySelector('.preset-head')?.scrollIntoView({ block: 'center' });
await sleep(300);

const box = (el) => {
  const r = el.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height) };
};

const rows = [...document.querySelectorAll('.preset-row')];
const names = [...document.querySelectorAll('.preset-name')].map(box);
const drops = [...document.querySelectorAll('.preset-drop')].map(box);
const restore = document.querySelector('.preset-head button');

return {
  coarse: matchMedia('(pointer: coarse)').matches,
  rowH: rows.map((r) => Math.round(r.getBoundingClientRect().height)),
  nameH: names.map((n) => n.h),
  nameW: names.map((n) => n.w),
  dropH: drops.map((d) => d.h),
  dropW: drops.map((d) => d.w),
  restoreH: Math.round(restore.getBoundingClientRect().height),
  listH: Math.round(document.querySelector('.preset-list').getBoundingClientRect().height),
  // 有没有哪一格矮于 44
  tooShort: [...names, ...drops].filter((b) => b.h < 44).length,
};
