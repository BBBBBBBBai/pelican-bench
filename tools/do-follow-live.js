// --do 文件：把活通道挂着（mock-hang 永不收尾），让这颗键停在「开着」那一态。
// 用 `probe` 跑它 → 后面紧跟的内置 AUDIT 就会量到「扣下去」的这颗键
// （对比度、裁切、触控目标）；用 `shot` 跑它 → 截到开着的样子。
// 不清场，配对的清场脚本是 tools/do-follow-cleanup.js。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const set = (id, v) => {
  const el = document.getElementById(id);
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

const already = document.querySelector('.ch.live .btn[aria-pressed]');
if (!already) {
  [...document.querySelectorAll('.bay-head button')]
    .find((b) => b.textContent.trim() === '新建')
    ?.click();
  await sleep(500);
  set('f-name', 'ZZLIVE');
  set('f-url', 'http://127.0.0.1:9911');
  set('f-key', 'probe-key');
  await sleep(150);
  document.querySelector('.prov-form button[type="submit"]')?.click();
  await sleep(1300);
  [...document.querySelectorAll('.roster .slot')]
    .find((s) => s.querySelector('.slot-name')?.textContent.trim() === 'ZZLIVE')
    ?.click();
  await sleep(400);
  set('o-model', 'mock-hang');
  await sleep(200);
  document.querySelector('.btn.arm')?.click();
  for (let i = 0; i < 40 && !document.querySelector('.ch.live .btn[aria-pressed]'); i += 1) {
    await sleep(250);
  }
  await sleep(900);
}

// 把活通道滚进视线，截图才拍得到
document.querySelector('.ch.live')?.scrollIntoView({ block: 'center' });
await sleep(600);

const el = document.querySelector('.ch.live .btn[aria-pressed]');
if (!el) return { error: 'no live channel' };
const cs = getComputedStyle(el);
return {
  label: el.textContent.trim(),
  pressed: el.getAttribute('aria-pressed'),
  background: cs.backgroundColor,
  color: cs.color,
  boxShadow: cs.boxShadow,
  transitionDuration: cs.transitionDuration,
  transitionProperty: cs.transitionProperty,
  rect: (() => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  })(),
  streamText: document.querySelector('.ch.live .stream')?.textContent?.slice(0, 30) ?? null,
};
