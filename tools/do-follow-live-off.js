// --do 文件：同 do-follow-live.js 把活通道挂起来，但**在同一个浏览器里**把它按成关掉，
// 用来截开 / 关的对照图。（两次 `shot` 是两次全新浏览器，所以必须一趟里做完。）
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

const read = () => {
  const el = document.querySelector('.ch.live .btn[aria-pressed]');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    label: el.textContent.trim(),
    pressed: el.getAttribute('aria-pressed'),
    background: cs.backgroundColor,
    color: cs.color,
    boxShadow: cs.boxShadow,
    rect: (() => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    })(),
  };
};

const on = read();

// 关掉，并在同一趟里确认它真的回到了「平」的样子
document.querySelector('.ch.live .btn[aria-pressed]')?.click();
await sleep(400);
const off = read();

document.querySelector('.ch.live')?.scrollIntoView({ block: 'center' });
await sleep(600);

// 截图前再读一次：`scrollIntoView` 会滚动页面，而 LiveBay 的 onScroll 在离底 <24px 时
// 会把 follow 同步回 true —— 必须确认截图那一刻它还是关着的。
const afterScroll = read();

return { on, off, afterScroll, streamText: document.querySelector('.ch.live .stream')?.textContent?.slice(0, 30) ?? null };
