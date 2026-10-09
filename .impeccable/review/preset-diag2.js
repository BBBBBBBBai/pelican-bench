// 诊断 2：拦下所有 /api/config 的写请求，看表尾那格的提交到底走没走到 saveGlobal。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const puts = [];
const orig = window.fetch;
window.fetch = function (url, init) {
  const u = String(url);
  if (u.includes('/api/config') && init && init.method === 'PUT') puts.push(init.body);
  return orig.apply(this, arguments);
};

// 同时听 React 那层的 blur/focusout 有没有真的到
const heard = [];
const rows = () => [...document.querySelectorAll('.preset-row')];
const tail = () => rows()[rows().length - 1].querySelector('input.preset-name');

const input = tail();
input.addEventListener('focusout', () => heard.push('focusout'), true);
input.addEventListener('blur', () => heard.push('blur'), true);

input.focus();
await sleep(120);
const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
d.set.call(input, '__DIAG2__');
input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(250);
const domValue = input.value;

input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await sleep(900);

const cfg = await fetch('/api/config').then((r) => r.json());
window.fetch = orig;

await orig.call(window, '/api/config', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ modelPresets: cfg.modelPresets.filter((m) => m !== '__DIAG2__') }),
});

return {
  heard,
  domValue,
  puts,
  cfgHasDiag: cfg.modelPresets.includes('__DIAG2__'),
  cfgLen: cfg.modelPresets.length,
  tailValue: tail()?.value,
  // 这一格上到底挂了什么：React 的 props 藏在这里
  reactKey: Object.keys(tail() || {}).filter((k) => k.startsWith('__react')),
};
