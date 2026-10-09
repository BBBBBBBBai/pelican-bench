// 诊断 5：直接手动调用 React 挂上去的 onBlur（按 React 的约定传合成事件），
// 看处理函数本身对不对；再把事件投递那一环单独验一次。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = () => [...document.querySelectorAll('.preset-row')];
const tail = () => rows()[rows().length - 1].querySelector('input.preset-name');

const puts = [];
const orig = window.fetch;
window.fetch = function (url, init) {
  if (String(url).includes('/api/config') && init && init.method === 'PUT') puts.push(init.body);
  return orig.apply(this, arguments);
};

const errs = [];
window.addEventListener('error', (e) => errs.push(String(e.message)));

const input = tail();
const props = input[Object.keys(input).find((k) => k.startsWith('__reactProps$'))];

// ① 手动喂一个「长得像 React 合成事件」的对象
props.onCommit !== undefined;
props.onChange({ target: { value: '__DIAG5__' }, currentTarget: input });
await sleep(200);
props.onBlur({ target: { value: '__DIAG5__' }, currentTarget: input });
await sleep(900);

const cfg = await fetch('/api/config').then((r) => r.json());
const out = {
  putsAfterManual: puts.slice(),
  cfgLen: cfg.modelPresets.length,
  cfgHasDiag5: cfg.modelPresets.includes('__DIAG5__'),
  errs,
};

window.fetch = orig;
await orig.call(window, '/api/config', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ modelPresets: cfg.modelPresets.filter((m) => m !== '__DIAG5__') }),
});
return out;
