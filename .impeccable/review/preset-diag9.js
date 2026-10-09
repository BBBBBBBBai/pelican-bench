// 诊断 9：分辨「程序化 blur 在无头浏览器里不发 focusout」是探针假象还是真缺陷。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const puts = [];
const orig = window.fetch;
window.fetch = function (url, init) {
  if (String(url).includes('/api/config') && init && init.method === 'PUT') puts.push(init.body);
  return orig.apply(this, arguments);
};

const rows = () => [...document.querySelectorAll('.preset-row')];
const tail = () => rows()[rows().length - 1].querySelector('input.preset-name');

const out = { hasFocus: document.hasFocus(), visibility: document.visibilityState };

// ① 换用「真 focusout 事件」投递：React 就是在根上听 focusout 的
let input = tail();
input.focus();
await sleep(150);
const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
d.set.call(input, '__DIAG9__');
input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(250);
input.blur();
input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
await sleep(900);
out.putsAfterFocusout = puts.length;
out.body = puts.slice();

const cfg = await fetch('/api/config').then((r) => r.json());
out.cfgLen = cfg.modelPresets.length;
out.cfgHasDiag9 = cfg.modelPresets.includes('__DIAG9__');

window.fetch = orig;
await orig.call(window, '/api/config', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ modelPresets: cfg.modelPresets.filter((m) => m !== '__DIAG9__') }),
});
return out;
