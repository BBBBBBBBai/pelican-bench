(async () => {
  // polish 收尾验证：活区归属、三个常数、槽位几何、行高。
  // 注意 driver 把文件内容当**表达式**求值（tools/edge-cdp.mjs:259-261），
  // 所以整块必须包在 async IIFE 里，顶层 return 是非法的。
  const out = {};
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
  };
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  const pick = document.querySelector('.model-pick');
  const slot = document.querySelector('.mp-slot');
  const grid = document.querySelector('#mp-grid');
  const foot = document.querySelector('.mp-foot');
  const cells = [...document.querySelectorAll('.mp-slot .mp-cell')];

  out.tokens = pick
    ? {
        rowH: cs(pick).getPropertyValue('--mp-row-h').trim(),
        footH: cs(pick).getPropertyValue('--mp-foot-h').trim(),
        rows: cs(pick).getPropertyValue('--mp-rows').trim(),
      }
    : null;
  out.geom = {
    slot: r(slot),
    grid: r(grid),
    foot: r(foot),
    cellCount: cells.length,
    cellH: cells[0] ? +cells[0].getBoundingClientRect().height.toFixed(1) : null,
  };
  out.slotMax = slot ? cs(slot).maxBlockSize : null;
  out.gridMax = grid ? cs(grid).maxBlockSize : null;
  out.gridCols = grid ? cs(grid).gridTemplateColumns : null;
  out.cellW = cells[0] ? +cells[0].getBoundingClientRect().width.toFixed(1) : null;
  out.footText = foot ? foot.textContent.trim() : null;

  out.liveRegions = [...document.querySelectorAll('[role="status"], [aria-live]')].map((el) => ({
    tag: el.tagName.toLowerCase(),
    cls: typeof el.className === 'string' ? el.className : null,
    role: el.getAttribute('role'),
    ariaLive: el.getAttribute('aria-live'),
    text: (el.textContent || '').trim().slice(0, 40),
    offscreen: el.getBoundingClientRect().left < -1000,
  }));
  out.footSpanRole = foot?.querySelector('span')?.getAttribute('role') ?? null;
  out.emptyHasStatus = !!document.querySelector('.mp-empty[role="status"]');

  const input = document.querySelector('#o-model');
  if (input) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'zzz-no-such-model-xyz');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(260);
    const empty = document.querySelector('.mp-empty');
    out.empty = {
      present: !!empty,
      role: empty ? empty.getAttribute('role') : null,
      text: empty ? empty.textContent.trim() : null,
      gridEmptyAttr: grid ? grid.getAttribute('data-empty') : null,
      grid: r(grid),
      slot: r(slot),
      footText: foot ? foot.textContent.trim() : null,
    };
    setter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(200);
    out.restoredCount = document.querySelectorAll('.mp-slot .mp-cell').length;
  }

  return out;
})()
