// 诊断 3：直接把 React 挂在这一格上的 props 读出来，并手动调用它的 onBlur / onKeyDown。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = () => [...document.querySelectorAll('.preset-row')];
const tail = () => rows()[rows().length - 1].querySelector('input.preset-name');

const input = tail();
const key = Object.keys(input).find((k) => k.startsWith('__reactProps$'));
const props = input[key];

const out = {
  propKeys: Object.keys(props),
  hasOnBlur: typeof props.onBlur,
  hasOnKeyDown: typeof props.onKeyDown,
  hasOnChange: typeof props.onChange,
  autoFocus: props.autoFocus,
  value: props.value,
};

// 手动走一遍 React 的调用约定
input.focus();
await sleep(100);
props.onChange({ target: input, currentTarget: input });
await sleep(100);
try {
  props.onKeyDown({ key: 'Enter', currentTarget: input });
  out.keyDownOk = true;
} catch (e) {
  out.keyDownErr = String(e);
}
await sleep(900);

const cfg = await fetch('/api/config').then((r) => r.json());
out.cfgLen = cfg.modelPresets.length;
out.put = await (async () => {
  // 看看最终有没有多出东西
  return cfg.modelPresets;
})();
await fetch('/api/config', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ modelPresets: cfg.modelPresets.filter((m) => m !== '__DIAG3__') }),
});
return out;
