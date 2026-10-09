/* 手机端筛选横杆：默认一行摘要，点开后展开全部筛选，再点收回。
   量展开时的高度、摘要文字、以及横杆钉在顶部时会不会盖住日期带。 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const px = (v) => Math.round(v * 10) / 10;
const rail = document.querySelector('.rail');
const toggle = document.querySelector('.rail-toggle');
const line = document.querySelector('.rail-line');
const full = document.querySelector('.rail-full');

const snap = (phase) => {
  const rr = rail.getBoundingClientRect();
  const band = document.querySelector('.rack-band');
  const below = document.elementFromPoint(180, Math.round(rr.bottom) + 4);
  return {
    phase,
    railH: px(rr.height),
    lineH: px(line.getBoundingClientRect().height),
    fullH: px(full.getBoundingClientRect().height),
    cur: document.querySelector('.rail-cur')?.textContent?.trim() ?? null,
    expanded: toggle.getAttribute('aria-expanded'),
    belowRail: below ? below.tagName + '.' + String(below.className).slice(0, 22) : null,
    bandY: band ? px(band.getBoundingClientRect().y) : null,
  };
};

const out = { closed: snap('closed') };

// 点开
const tr = toggle.getBoundingClientRect();
toggle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: tr.x + 10, clientY: tr.y + 10 }));
toggle.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', clientX: tr.x + 10, clientY: tr.y + 10 }));
toggle.click();
await sleep(450);
out.open = snap('open');
out.detentsVisible = [...document.querySelectorAll('.detents > button')].filter((b) => b.getBoundingClientRect().height > 0).length;

// 展开后滚一段，看钉子还在不在
window.scrollTo(0, 2600);
await sleep(320);
out.stuckOpen = snap('stuckOpen');
out.pageH = Math.round(document.documentElement.scrollHeight);

// 收回
toggle.click();
await sleep(450);
window.scrollTo(0, 0);
await sleep(200);
out.reclosed = snap('reclosed');
return out;
