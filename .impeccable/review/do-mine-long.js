const q = (s) => document.querySelector(s);
const cs = (el) => getComputedStyle(el);
const el = q('#o-model');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
const set = (v) => { setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
const cell = q('.mp-cell');
const dot = q('.mp-dot');
const grid = q('.mp-grid');
set('deepseek-v3.2-reasoner-preview-20250929-extended-long-name-v1-78chars');
const longName = {
  len: el.value.length,
  scrollWidth: el.scrollWidth,
  clientWidth: el.clientWidth,
  overflowX: cs(el).overflowX,
  textOverflow: cs(el).textOverflow,
  whiteSpace: cs(el).whiteSpace,
  scrollLeft: el.scrollLeft,
  // 输入框失焦时能看到名字的开头还是结尾
  shows: el.scrollLeft === 0 ? 'head' : 'tail',
};
set('gpt-6.1');
return JSON.stringify({
  viewport: innerWidth + 'x' + innerHeight,
  cellH: cell.getBoundingClientRect().height,
  cellW: cell.getBoundingClientRect().width,
  dot: dot.getBoundingClientRect().width + 'x' + dot.getBoundingClientRect().height,
  gridH: grid.getBoundingClientRect().height,
  gridClientH: grid.clientHeight,
  gridScrollH: grid.scrollHeight,
  longName,
  scrollbar: {
    width: cs(grid).scrollbarWidth,
    color: cs(grid).scrollbarColor,
    gridBg: cs(grid).backgroundColor,
  },
}, null, 1);
