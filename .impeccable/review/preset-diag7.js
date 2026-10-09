// 诊断 7：把「真实 blur」那一刻的 e.target.value 抓下来，并统计 PUT。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = () => [...document.querySelectorAll('.preset-row')];
const tail = () => rows()[rows().length - 1].querySelector('input.preset-name');

const puts = [];
const orig = window.fetch;
window.fetch = function (url, init) {
  if (String(url).includes('/api/config') && init && init.method === 'PUT') puts.push(init.body);
  return orig.apply(this, arguments);
};

const seen = [];
// 每一步都重新取节点，避免拿着被替换掉的旧节点
let input = tail();
input.focus();
await sleep(150);
seen.push(['focusOk', document.activeElement === input]);

// 在「当前这个」节点上挂捕获监听，记下 blur 那一刻浏览器手里的值
const attach = (el) => {
  el.addEventListener('blur', (e) => seen.push(['nativeBlur', e.target.value]), true);
  el.addEventListener('focusout', (e) => seen.push(['nativeFocusout', e.target.value]), true);
  el.addEventListener('keydown', (e) => seen.push(['nativeKeydown', e.key]), true);
};
attach(input);

const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
d.set.call(input, '__DIAG7__');
input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(250);

seen.push(['nodeReplaced', tail() !== input]);
input = tail();
seen.push(['valueBeforeEnter', input.value]);

input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
await sleep(120);
seen.push(['activeAfter', document.activeElement?.tagName + '.' + String(document.activeElement?.className)]);
seen.push(['valueAfter', tail().value]);
await sleep(900);

const cfg = await fetch('/api/config').then((r) => r.json());
seen.push(['cfgHasDiag7', cfg.modelPresets.includes('__DIAG7__')]);
seen.push(['puts', puts.length]);

window.fetch = orig;
await orig.call(window, '/api/config', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ modelPresets: cfg.modelPresets.filter((m) => m !== '__DIAG7__') }),
});
return seen;
