// 跑一次，让总线条右端出现「被跟踪的那一路」读数（验证被跟踪项跨带高亮）
// mock-good 约 550ms 跑完，所以要等落盘 + 列表重载之后再读。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const slot = [...document.querySelectorAll('.roster .slot')].find(
  (el) => el.querySelector('.slot-name')?.textContent === '原厂直连',
);
if (!slot) return { error: 'no 原厂直连 slot' };
slot.click();
await sleep(300);

// 模型名从档案搬到了「本次运行」，不填就按不动开始生成。
const m = document.getElementById('o-model');
if (m) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(m, 'mock-good');
  m.dispatchEvent(new Event('input', { bubbles: true }));
}
await sleep(300);

document.querySelector('.btn.arm')?.click();
await sleep(2600);

const track = document.querySelector('.bus-track');
return {
  busTrackPresent: Boolean(track),
  busTrackText: track?.textContent?.trim() ?? null,
  live: track?.dataset.live ?? null,
  trackedCell: document.querySelector('.ch[data-tracked="true"] .ch-no')?.textContent ?? null,
  armBack: document.querySelector('.btn.arm')?.textContent?.trim() ?? null,
};
