// Does the candidate grid's height changes re-flow everything below it while typing?
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const setVal = (el, v) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

const input = document.getElementById('o-model');
const grid = document.querySelector('.mp-grid');
const runBtn = [...document.querySelectorAll('button')].find((b) =>
  (b.textContent || '').includes('开始生成'),
);
const panel = document.querySelector('.panel, .panel-scroll') || document.body;

const y = (el) => (el ? Math.round(el.getBoundingClientRect().top) : null);
const anchor = {
  runBtn: y(runBtn),
  gridTop: y(grid),
  gridBottom: Math.round(grid.getBoundingClientRect().bottom),
  noteBelow: y(document.querySelector('.model-pick ~ .note, .note')),
  panelScrollTop: panel.scrollTop,
};

const samples = [];
for (const q of ['', 'd', 'ds', 'dsr', 'dsrx', 'zzz', '']) {
  setVal(input, q);
  await wait(320);
  samples.push({
    q: q || '(empty)',
    rows: document.querySelectorAll('.mp-cell').length,
    gridH: Math.round(grid.getBoundingClientRect().height),
    runBtnTop: y(runBtn),
    panelBottomAnchor: y(document.querySelector('.panel-scroll')?.lastElementChild),
    panelScrollHeight: panel.scrollHeight,
    panelScrollTop: panel.scrollTop,
  });
}

// how far does the run button travel between the empty query and a 1-row query?
const tops = samples.map((s) => s.runBtnTop).filter((v) => v != null);
const travel = Math.max(...tops) - Math.min(...tops);

return { anchor, samples, runBtnTravelPx: travel };
