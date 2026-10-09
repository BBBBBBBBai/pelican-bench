// 让页面进入「正在跑」的状态：选中指定供应商 → 点开始生成 → 等一会儿
const NAME = '__LIVE_PROBE__';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 选中名册里叫 NAME 的那个工位
const slot = [...document.querySelectorAll('.roster .slot')].find(
  (el) => el.querySelector('.slot-name')?.textContent === NAME,
);
if (!slot) return { error: `no roster slot named ${NAME}` };
slot.click();
await sleep(350);

// 模型名是「本次运行」的必填输入（不在档案里）；不填它开始生成是禁用的。
const m = document.getElementById('o-model');
if (m) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(m, 'mock-good');
  m.dispatchEvent(new Event('input', { bubbles: true }));
}
await sleep(250);

const arm = document.querySelector('.btn.arm');
if (!arm) return { error: 'no .btn.arm' };
arm.click();
await sleep(1400);

const live = document.querySelector('.ch.live');
return {
  clicked: NAME,
  livePresent: Boolean(live),
  liveText: live?.querySelector('.stream')?.textContent?.slice(0, 120) ?? null,
  hasStop: Boolean(document.querySelector('.btn.halt')),
  lampLive: Boolean(document.querySelector('.ch.live .lamp.live')),
  promptLine: live?.querySelector('.prompt-line')?.textContent?.slice(0, 90) ?? null,
};
