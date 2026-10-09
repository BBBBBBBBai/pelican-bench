// --do 文件：「自动滚动 / FOLLOW」那颗键的选中态验收。
//
// 全程不碰真实供应商：临时建一家 ZZFOLLOW 指向本地假供应商（127.0.0.1:9911），
// 用 mock-hang 跑一次 —— 它吐完 `<svg ` 就永不结束，活通道会一直挂在架子上，
// 留足时间读这颗键在「开着 / 关掉 / 再开」三态下真正被渲染成了什么。
// 读完点停止键中止，再把临时档案删干净（没有跑完就不会留下记录）。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const set = (id, v) => {
  const el = document.getElementById(id);
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

// 这颗键到底长什么样 —— 本轮唯一要断言的东西
const skin = () => {
  const el = document.querySelector('.ch.live .btn[aria-pressed]');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    label: el.textContent.trim(),
    pressed: el.getAttribute('aria-pressed'),
    background: cs.backgroundColor,
    color: cs.color,
    borderColor: cs.borderTopColor,
    boxShadow: cs.boxShadow,
    transform: cs.transform,
    transitionDuration: cs.transitionDuration,
    transitionProperty: cs.transitionProperty,
    scrollW: el.scrollWidth,
    clientW: el.clientWidth,
    overflowPx: el.scrollWidth - el.clientWidth,
  };
};

const records = async () => (await (await fetch('/api/records')).json()).records;
const result = {};
result.countBefore = (await records()).length;

// ── 1. 临时档案 → 本地假供应商 ──────────────────────────────────────────
[...document.querySelectorAll('.bay-head button')]
  .find((b) => b.textContent.trim() === '新建')
  ?.click();
await sleep(500);
set('f-name', 'ZZFOLLOW');
set('f-url', 'http://127.0.0.1:9911');
set('f-key', 'probe-key');
await sleep(150);
document.querySelector('.prov-form button[type="submit"]')?.click();
await sleep(1300);

const slot = [...document.querySelectorAll('.roster .slot')].find(
  (s) => s.querySelector('.slot-name')?.textContent.trim() === 'ZZFOLLOW',
);
result.slotPresent = Boolean(slot);
slot?.click();
await sleep(400);

// ── 2. 跑一次 mock-hang，活通道永不收尾 ─────────────────────────────────
set('o-model', 'mock-hang');
await sleep(200);
result.armEnabled = document.querySelector('.btn.arm')?.disabled === false;
document.querySelector('.btn.arm')?.click();

const liveBtn = () => document.querySelector('.ch.live .btn[aria-pressed]');
for (let i = 0; i < 40 && !liveBtn(); i += 1) await sleep(250);
result.livePresent = Boolean(document.querySelector('.ch.live'));
result.streamText = document.querySelector('.ch.live .stream')?.textContent?.slice(0, 40) ?? null;
await sleep(700); // 让流跑几帧，别读到一个刚挂上来的空壳

// ── 3. 三态读数 ─────────────────────────────────────────────────────────
result.defaultPressed = liveBtn()?.getAttribute('aria-pressed') ?? null;
result.on = skin();

liveBtn()?.click();
await sleep(320);
result.afterClickPressed = document
  .querySelector('.ch.live .btn[aria-pressed]')
  ?.getAttribute('aria-pressed') ?? null;
result.off = skin();

document.querySelector('.ch.live .btn[aria-pressed]')?.click();
await sleep(320);
result.backOn = skin();

// 开着时 hover 会不会被 `.btn.quiet:hover` 抢掉底与字
liveBtn()?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
result.stopBtnPresent = Boolean(document.querySelector('.ch.live .btn.halt'));

// 停止键中止这趟跑，别留一个永远在跑的通道
document.querySelector('.ch.live .btn.halt')?.click();
await sleep(1600);
result.stopped = !document.querySelector('.ch.live');

// ── 4. 收拾：删临时档案 ─────────────────────────────────────────────────
const s2 = [...document.querySelectorAll('.roster .slot')].find(
  (s) => s.querySelector('.slot-name')?.textContent.trim() === 'ZZFOLLOW',
);
s2?.click();
await sleep(450);
const del = document.querySelector('.prov-slot-out button.halt');
del?.click();
await sleep(280);
del?.click();
await sleep(1300);
result.cleaned = ![...document.querySelectorAll('.roster .slot-name')].some(
  (n) => n.textContent.trim() === 'ZZFOLLOW',
);
// 这趟没有跑完，不该多出记录
result.countAfter = (await records()).length;
result.countRestored = result.countAfter === result.countBefore;

return result;
