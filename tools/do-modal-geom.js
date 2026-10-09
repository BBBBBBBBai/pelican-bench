// 打开弹窗后回报几何，用于窄屏判断是否该全出血。
// 用 `--do=` 调用。
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const cell = document.querySelector('.ch:not(.live)');
if (!cell) return { error: 'no cell' };
cell.click();
await wait(1300);

const sheet = document.querySelector('.sheet');
const plate = document.querySelector('.sheet-plate');
const main = document.querySelector('.sheet-main');
const facts = document.querySelector('.sheet-facts');
if (!sheet) return { error: 'no sheet' };

const box = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
    scrollH: el.scrollHeight, clientH: el.clientHeight,
    scrollW: el.scrollWidth, clientW: el.clientWidth,
    overflowY: cs.overflowY,
  };
};

// 面板有没有超出视口
const r = sheet.getBoundingClientRect();
return {
  viewport: { w: innerWidth, h: innerHeight },
  plate: box(plate),
  platePadding: getComputedStyle(plate).padding,
  sheet: box(sheet),
  sheetFitsViewport: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5,
  head: box(document.querySelector('.sheet-head')),
  body: box(document.querySelector('.sheet-body')),
  main: box(main),
  facts: box(facts),
  bodyCols: getComputedStyle(document.querySelector('.sheet-body')).gridTemplateColumns,
  plateInner: box(document.querySelector('.plate')),
  iframe: box(document.querySelector('.plate iframe')),
  docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  docOverflowY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  // 嵌套滚动条：内容区是否比容器高
  mainScrolls: main ? main.scrollHeight > main.clientHeight + 1 : null,
  factsScrolls: facts ? facts.scrollHeight > facts.clientHeight + 1 : null,
};
