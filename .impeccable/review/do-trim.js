const el = document.getElementById('o-model');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
const set = (v) => { setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
const snap = (tag) => ({
  tag,
  rawValue: JSON.stringify(el.value),
  selectedRows: document.querySelectorAll('.mp-cell[aria-selected="true"]').length,
  rows: document.querySelectorAll('.mp-cell').length,
  // 界面显示的就是输入框里的原文；请求发出去的是 trim 之后的
  wouldSend: JSON.stringify(el.value.trim()),
  matchesRow: [...document.querySelectorAll('.mp-name')].some(n => n.textContent === el.value),
});
const out = {};
set('gpt-6.1');   out.clean = snap('精确值，无空格');
set('gpt-6.1 ');  out.trailing = snap('尾部一个空格（视觉上完全一样）');
set(' gpt-6.1');  out.leading = snap('前导一个空格');
set('  gpt-6.1  '); out.both = snap('前后各两个空格');
set(''); out.reset = snap('清空');
return JSON.stringify(out, null, 1);
