/**
 * probe-checkhit.js —— 量 `.check` 的真实命中区。
 * DESIGN.md 说「命中区是整行文字加方块」，要验证这句是不是真的，
 * 以及点击方块右侧 10px 处到底算不算点在控件上。
 * 用 --expr 传给 edge-cdp.mjs。
 */
(async () => {
  const px = (v) => Math.round(v * 10) / 10;
  const out = {};

  const checks = Array.from(document.querySelectorAll('.check'));
  out.checkCount = checks.length;
  out.checks = checks.map((label) => {
    const input = label.querySelector('input');
    const lr = label.getBoundingClientRect();
    const ir = input ? input.getBoundingClientRect() : null;
    return {
      labelText: (label.textContent || '').trim().slice(0, 26),
      labelBox: { w: px(lr.width), h: px(lr.height) },
      inputBox: ir ? { w: px(ir.width), h: px(ir.height) } : null,
      // 标签是否真的包着控件（点了就算）
      inputInsideLabel: !!input,
      cursorOnLabel: getComputedStyle(label).cursor,
      // 命中区：label 整块是不是可点的
      labelIsHitArea: lr.height >= 24 && lr.width >= 24,
    };
  });

  // 真的在方块右侧 40px、标签行内点一下，看状态有没有翻转
  const first = checks[0];
  if (first) {
    const input = first.querySelector('input');
    const before = input.checked;
    const lr = first.getBoundingClientRect();
    const target = document.elementFromPoint(lr.left + lr.width - 6, lr.top + lr.height / 2);
    // 用 label.click() 模拟点标签文字区
    first.click();
    const after = input.checked;
    out.hitTest = {
      pointRightOfBox: target ? (target.tagName + '.' + (typeof target.className === 'string' ? target.className : '')) : null,
      checkedBefore: before,
      checkedAfterLabelClick: after,
      togglesFromLabelArea: before !== after,
    };
    // 恢复
    if (input.checked !== before) first.click();
  }

  // 页面里所有 <label> 的可点面积
  out.allLabels = Array.from(document.querySelectorAll('label')).map((l) => {
    const r = l.getBoundingClientRect();
    return { cls: l.className, text: (l.textContent || '').trim().slice(0, 22), w: px(r.width), h: px(r.height) };
  }).slice(0, 12);

  return out;
})()
