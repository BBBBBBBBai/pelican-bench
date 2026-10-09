// 诊断 8：把键盘从等式里拿掉。只 focus 再 blur，看 PUT 会不会发生。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const puts = [];
const orig = window.fetch;
window.fetch = function (url, init) {
  if (String(url).includes('/api/config') && init && init.method === 'PUT') puts.push(init.body);
  return orig.apply(this, arguments);
};

const rows = () => [...document.querySelectorAll('.preset-row')];
const tail = () => rows()[rows().length - 1].querySelector('input.preset-name');

const out = {};

// ① 空着直接 focus → blur：什么也不该发生
let input = tail();
input.focus();
await sleep(150);
input.blur();
await sleep(700);
out.putsAfterEmptyBlur = puts.length;

// ② 写进真值再 blur（不经过键盘）
puts.length = 0;
input = tail();
input.focus();
await sleep(150);
const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
d.set.call(input, '__DIAG8__');
input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(250);
input.blur();
await sleep(900);
out.putsAfterSetBlur = puts.length;
out.putBodies = puts.slice();

// ③ 换一种：用 CDP 那种真键盘走不了，改成先 focus 再让 React 收到 focusout
const cfg = await fetch('/api/config').then((r) => r.json());
out.cfgLen = cfg.modelPresets.length;
out.cfgHasDiag8 = cfg.modelPresets.includes('__DIAG8__');

window.fetch = orig;
await orig.call(window, '/api/config', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ modelPresets: cfg.modelPresets.filter((m) => m !== '__DIAG8__') }),
});
return out;
