// --do 文件：配 do-follow-live.js 的清场 —— 中止活通道 + 删临时档案 + 按供应商名扫掉记录。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const records = async () => (await (await fetch('/api/records')).json()).records;
const before = (await records()).length;

document.querySelector('.ch.live .btn.halt')?.click();
await sleep(1600);

const s = [...document.querySelectorAll('.roster .slot')].find(
  (x) => x.querySelector('.slot-name')?.textContent.trim() === 'ZZLIVE',
);
s?.click();
await sleep(450);
const del = document.querySelector('.prov-slot-out button.halt');
del?.click();
await sleep(280);
del?.click();
await sleep(1300);

for (const r of (await records()).filter((r) => r.providerName === 'ZZLIVE')) {
  await fetch(`/api/records/${r.id}`, { method: 'DELETE' });
}
await sleep(200);
return {
  stopped: !document.querySelector('.ch.live'),
  providerRemoved: ![...document.querySelectorAll('.roster .slot-name')].some(
    (n) => n.textContent.trim() === 'ZZLIVE',
  ),
  recordsRestored: (await records()).length === before,
  recordsLeft: (await records()).filter((r) => r.providerName === 'ZZLIVE').length,
};
