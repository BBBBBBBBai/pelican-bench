/* 模型选择器在手指下：点一下要能选中，沿着列表滑要滚列表而不是误选。
   依赖 edge-cdp 的 --do（页面里跑）与 --touch（真触摸模态）。 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const grid = document.querySelector('.mp-grid');
const cells = [...grid.querySelectorAll('.mp-cell')];
const before = {
  gridH: Math.round(grid.getBoundingClientRect().height),
  scrollH: grid.scrollHeight,
  scrollable: grid.scrollHeight > grid.clientHeight + 1,
  cellH: cells[0] ? Math.round(cells[0].getBoundingClientRect().height) : null,
  selected: cells.filter((c) => c.getAttribute('aria-selected') === 'true').map((c) => c.textContent.trim()),
};

// 1) 点第一格：应该被选中，且输入框写上这个名字
const first = cells[0];
const r = first.getBoundingClientRect();
first.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
first.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
first.click();
await sleep(260);
const after = {
  selected: cells.filter((c) => c.getAttribute('aria-selected') === 'true').map((c) => c.textContent.trim()),
  input: document.querySelector('#o-model')?.value ?? null,
  start: (() => {
    const b = document.querySelector('.panel .btn.arm.xl, .panel .btn.halt.xl');
    if (!b) return null;
    const rect = b.getBoundingClientRect();
    return { vpY: Math.round(rect.y * 10) / 10, h: Math.round(rect.height), disabled: b.disabled, text: b.textContent.trim() };
  })(),
};
return { before, after };
