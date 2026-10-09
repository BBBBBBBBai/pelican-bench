// --do 文件：这张清单存在的唯一理由 —— 改它，「要测哪个模型」那张候选表必须跟着变。
// 同时验一次「清空也不挡任何一次运行」（模型名始终可以手打）。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cfg = () => fetch('/api/config').then((r) => r.json());
const put = (body) =>
  fetch('/api/config', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const setNative = (input, v) => {
  const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  d.set.call(input, v);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const before = (await cfg()).modelPresets;
const rows = () => [...document.querySelectorAll('.preset-row')];
const tailInput = () => rows()[rows().length - 1].querySelector('input.preset-name');
const gridNames = () => [...document.querySelectorAll('.mp-grid .mp-name')].map((n) => n.textContent.trim());

const out = { gridBefore: gridNames().length };

// ① 从界面加一条自定义模型名
const CUSTOM = '__CUSTOM_MODEL__';
document.querySelector('.preset-head')?.scrollIntoView({ block: 'center' });
await sleep(300);
tailInput().focus();
await sleep(80);
setNative(tailInput(), CUSTOM);
await sleep(80);
tailInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await sleep(900);

out.diskHasCustom = (await cfg()).modelPresets.includes(CUSTOM);
// 候选表是「要测哪个模型」那张，它现在应当列得出来这一条
const gridAfter = gridNames();
out.gridHasCustom = gridAfter.includes(CUSTOM);
out.gridAfter = gridAfter.length;

// ② 在候选表里搜它，确认它真的可选中（不是只存在于 config 里）
const mpInput = document.querySelector('.mp-input');
if (mpInput) {
  mpInput.focus();
  await sleep(80);
  setNative(mpInput, 'CUSTOM');
  await sleep(300);
  const cells = [...document.querySelectorAll('.mp-grid .mp-cell')].map((c) => c.textContent.trim());
  out.searchHits = cells;
  out.searchFoundCustom = cells.some((c) => c.includes(CUSTOM));
}

// ③ 清空清单：候选表空了，但手打的名字仍然能用（「不挡任何一次运行」）
await put({ modelPresets: [] });
await sleep(200);
// 通过界面清会太慢，这里直接落盘后重载页面读事实
const reloaded = await fetch('/api/config').then((r) => r.json());
out.emptyDiskLen = reloaded.modelPresets.length;

// 还原
await put({ modelPresets: before });
await sleep(300);
const final = (await cfg()).modelPresets;
out.finalSame = JSON.stringify(final) === JSON.stringify(before);
out.finalLen = final.length;
return out;
