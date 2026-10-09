// probe-follow-hover.mjs 的分段：中止活通道 + 删掉临时档案。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const records = async () => (await (await fetch('/api/records')).json()).records;
const before = (await records()).length;
document.querySelector('.ch.live .btn.halt')?.click();
await sleep(1500);
const s = [...document.querySelectorAll('.roster .slot')].find(
  (x) => x.querySelector('.slot-name')?.textContent.trim() === 'ZZHOVER',
);
s?.click();
await sleep(450);
const del = document.querySelector('.prov-slot-out button.halt');
del?.click();
await sleep(280);
del?.click();
await sleep(1300);
// 没跑完的那一趟可能仍落了记录，按供应商名清掉
for (const r of (await records()).filter((r) => r.providerName === 'ZZHOVER')) {
  await fetch(`/api/records/${r.id}`, { method: 'DELETE' });
}
await sleep(200);
return {
  stopped: !document.querySelector('.ch.live'),
  providerRemoved: ![...document.querySelectorAll('.roster .slot-name')].some(
    (n) => n.textContent.trim() === 'ZZHOVER',
  ),
  recordsRestored: (await records()).length === before,
};
