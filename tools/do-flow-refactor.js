(async () => {
  // 流程改造的运行时断言：模型名搬出档案、搬出折叠块、成为开始生成的门禁。
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};

  const arm = document.querySelector('.btn.arm');
  const modelInput = document.querySelector('#o-model');
  const fold = document.querySelector('.fold');

  // 1. 门禁：没选模型名时按不动
  out.armDisabledWithNoModel = arm ? arm.disabled : null;
  out.armTitle = arm?.getAttribute('title') ?? null;

  // 2. 位置：模型名必须在折叠块外面
  out.modelInputExists = Boolean(modelInput);
  out.modelInputInsideFold = Boolean(modelInput && fold && fold.contains(modelInput));
  out.modelInputType = modelInput?.tagName ?? null;
  out.modelInputHasLabel = (() => {
    if (!modelInput) return null;
    const lab = document.querySelector(`label[for="${modelInput.id}"]`);
    return lab ? lab.textContent.trim() : null;
  })();
  out.modelInputAriaLabel = modelInput?.getAttribute('aria-label') ?? null;

  // 3. 折叠块里现在只剩参数
  out.foldInputs = fold
    ? [...fold.querySelectorAll('input,select,textarea')].map((e) => ({
        id: e.id || null,
        type: e.type,
      }))
    : null;
  out.foldSummary = fold?.querySelector('summary')?.textContent?.trim() ?? null;

  // 4. 候选表
  const cells = [...document.querySelectorAll('.mp-cell')];
  out.candidateCount = cells.length;
  out.candidateNames = cells.slice(0, 3).map((c) => c.querySelector('.mp-name')?.textContent ?? c.textContent.trim());
  out.cellTag = cells[0]?.tagName ?? null;
  out.cellRole = cells[0]?.getAttribute('role') ?? null;

  // 5. 表单里不该再有模型名输入框（添加供应商不填模型名）
  out.formHasModelField = Boolean(document.querySelector('#f-model'));
  out.formLabels = [...document.querySelectorAll('.field > label')].map((l) => l.textContent.trim());

  // 6. 名册副行：应该是主机名 + 协议 + 参数
  out.slotSub = document.querySelector('.roster .slot .slot-sub')?.textContent?.trim() ?? null;

  // 7. run-facts：不该再有「模型名」行
  const rdt = [...document.querySelectorAll('.run-facts dt')].map((d) => d.textContent.trim());
  const rdd = [...document.querySelectorAll('.run-facts dd')].map((d) => d.textContent.trim());
  out.runFactLabels = rdt;
  out.runFactValues = rdd;
  out.runFactsHasModel = rdt.includes('模型名') || rdt.includes('MODEL');

  // 8. 选中一个候选 → 按钮解锁
  if (cells[0]) {
    cells[0].click();
    await sleep(300);
    out.afterPickModelValue = modelInput?.value ?? null;
    out.afterPickArmDisabled = arm?.disabled ?? null;
    out.afterPickSelected = document.querySelectorAll('.mp-cell[aria-selected="true"]').length;
  }

  // 9. 模糊搜索
  if (modelInput) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(modelInput, 'dsr');
    modelInput.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);
    out.searchDsr = [...document.querySelectorAll('.mp-cell .mp-name')].map((n) => n.textContent.trim());
    setter.call(modelInput, 'zzzz');
    modelInput.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);
    out.searchNoMatch = document.querySelector('.mp-empty')?.textContent?.trim() ?? null;
    setter.call(modelInput, '');
    modelInput.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);
    out.searchCleared = document.querySelectorAll('.mp-cell').length;
  }

  out.overflowX = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);

  // 10. 几何：候选表占多高（会不会把开始生成挤到屏幕外）
  const grid = document.querySelector('.mp-grid');
  if (grid) {
    const r = grid.getBoundingClientRect();
    out.gridBox = { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
    out.gridScroll = { scrollH: grid.scrollHeight, clientH: grid.clientHeight, overflowY: getComputedStyle(grid).overflowY };
  }
  if (arm) {
    const r = arm.getBoundingClientRect();
    out.armBox = { top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) };
    out.armInViewport = r.top >= 0 && r.bottom <= window.innerHeight;
    out.viewportH = window.innerHeight;
  }

  return out;
})()
