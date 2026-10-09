// 诊断：表尾那格到底能不能拿到焦点、onChange 有没有进 React。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = () => [...document.querySelectorAll('.preset-row')];
const tail = () => rows()[rows().length - 1].querySelector('input.preset-name');

const input = tail();
const out = { found: !!input, before: document.activeElement?.className };

input.focus();
await sleep(120);
out.afterFocus = document.activeElement === input;
out.activeCls = document.activeElement?.className;
out.activeTag = document.activeElement?.tagName;

const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
d.set.call(input, '__DIAG__');
input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(200);
out.valueInDom = input.value;
out.reactSawIt = input.value === '__DIAG__';

// React 有没有把 input 换成新的节点（换掉了说明重渲染了）
out.sameNode = tail() === input;

// 直接派发 keydown 看会不会 blur
input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await sleep(300);
out.blurred = document.activeElement !== input;
out.activeAfterEnter = document.activeElement?.className;

const cfg = await fetch('/api/config').then((r) => r.json());
out.cfgLen = cfg.modelPresets.length;
out.cfgHasDiag = cfg.modelPresets.includes('__DIAG__');

// 清理
await fetch('/api/config', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ modelPresets: cfg.modelPresets.filter((m) => m !== '__DIAG__') }),
});
return out;
