// 诊断 4：把「真实用户操作」拆成每一步的可观察量，找出卡在哪一步。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = () => [...document.querySelectorAll('.preset-row')];
const tail = () => rows()[rows().length - 1].querySelector('input.preset-name');

const log = [];
const input = tail();

input.focus();
await sleep(150);
log.push(['focus', document.activeElement === input]);

const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
d.set.call(input, '__DIAG4__');
input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(300);
log.push(['afterInputDomValue', input.value]);
log.push(['afterInputReactValue', tail().value]);

const props = input[Object.keys(input).find((k) => k.startsWith('__reactProps$'))];
log.push(['propsValue', props.value]);

// 手动触发 React 的 onKeyDown（它内部会调 blur）
const fake = { key: 'Enter', currentTarget: input };
props.onKeyDown(fake);
await sleep(150);
log.push(['afterKeyDownActiveIsInput', document.activeElement === input]);
log.push(['afterKeyDownActiveTag', document.activeElement?.tagName + '.' + document.activeElement?.className]);

await sleep(900);
const cfg = await fetch('/api/config').then((r) => r.json());
log.push(['cfgLen', cfg.modelPresets.length]);
log.push(['cfgHasDiag4', cfg.modelPresets.includes('__DIAG4__')]);
log.push(['tailValueNow', tail()?.value]);

await fetch('/api/config', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ modelPresets: cfg.modelPresets.filter((m) => m !== '__DIAG4__') }),
});
return log;
