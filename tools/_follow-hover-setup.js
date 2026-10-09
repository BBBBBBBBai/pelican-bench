// probe-follow-hover.mjs 的分段：把活通道跑起来（临时档案 → mock-hang）。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const set = (id, v) => {
  const el = document.getElementById(id);
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};
[...document.querySelectorAll('.bay-head button')]
  .find((b) => b.textContent.trim() === '新建')
  ?.click();
await sleep(500);
set('f-name', 'ZZHOVER');
set('f-url', 'http://127.0.0.1:9911');
set('f-key', 'probe-key');
await sleep(150);
document.querySelector('.prov-form button[type="submit"]')?.click();
await sleep(1300);
const slot = [...document.querySelectorAll('.roster .slot')].find(
  (s) => s.querySelector('.slot-name')?.textContent.trim() === 'ZZHOVER',
);
slot?.click();
await sleep(400);
set('o-model', 'mock-hang');
await sleep(200);
document.querySelector('.btn.arm')?.click();
for (let i = 0; i < 40 && !document.querySelector('.ch.live .btn[aria-pressed]'); i += 1) {
  await sleep(250);
}
await sleep(900);
return {
  live: Boolean(document.querySelector('.ch.live')),
  pressed: document.querySelector('.ch.live .btn[aria-pressed]')?.getAttribute('aria-pressed') ?? null,
};
