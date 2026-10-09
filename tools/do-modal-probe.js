// 打开标本弹窗并回报几何 / 焦点 / 动画状态。
// 用 `--do=` 调用（edge-cdp 会自动包成 async IIFE，这里不要再包一层）。
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const cell = document.querySelector('.ch:not(.live)');
if (!cell) return { error: 'no cell' };
cell.click();
await wait(1200);

const plates = [...document.querySelectorAll('.sheet-plate')];
const sheets = [...document.querySelectorAll('.sheet')];
const scrims = [...document.querySelectorAll('.sheet-scrim')];
const sheet = sheets[0];
const plate = plates[0];
const scrim = scrims[0];

const box = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
};

const cs = sheet ? getComputedStyle(sheet) : null;
const scrimCS = scrim ? getComputedStyle(scrim) : null;
const plateCS = plate ? getComputedStyle(plate) : null;
const parentOfSheet = sheet ? sheet.parentElement?.className : null;
const parentOfPlate = plate ? plate.parentElement?.tagName : null;

const active = document.activeElement;

return {
  counts: { plates: plates.length, sheets: sheets.length, scrims: scrims.length },
  mountedUnder: parentOfPlate,
  sheetParent: parentOfSheet,
  sheetBox: box(sheet),
  viewport: { w: innerWidth, h: innerHeight },
  sheetCS: cs && {
    position: cs.position,
    inset: cs.inset,
    width: cs.width,
    height: cs.height,
    boxShadow: cs.boxShadow,
    border: cs.border,
    background: cs.background.slice(0, 40),
    animationName: cs.animationName,
    animationDuration: cs.animationDuration,
    transform: cs.transform,
    opacity: cs.opacity,
  },
  plateCS: plateCS && {
    position: plateCS.position,
    display: plateCS.display,
    padding: plateCS.padding,
    zIndex: plateCS.zIndex,
    gridTemplateColumns: plateCS.gridTemplateColumns,
  },
  scrimCS: scrimCS && {
    position: scrimCS.position,
    background: scrimCS.backgroundColor,
    zIndex: scrimCS.zIndex,
    animationName: scrimCS.animationName,
  },
  focusAfterOpen: active ? `${active.tagName}.${active.className}` : null,
  focusIsInsideDialog: sheet ? sheet.contains(active) : false,
  dialogRole: sheet?.getAttribute('role'),
  dialogLabel: sheet?.getAttribute('aria-label'),
  scrimAriaHidden: scrim?.getAttribute('aria-hidden'),
  docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  ledger: {
    bodyChildren: [...document.body.children].map((c) => c.className || c.tagName),
  },
};
