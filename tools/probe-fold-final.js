(async () => {
  // 抽屉的最终验证：桌面 + 手机、开 + 关、四态几何、reduced-motion 路径。
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};

  const geom = () => {
    const f = document.querySelector('.fold');
    if (!f) return { missing: true };
    const b = f.querySelector('.fold-body');
    const s = f.querySelector('summary');
    return {
      open: f.open,
      foldH: Math.round(f.getBoundingClientRect().height * 10) / 10,
      bodyH: Math.round(b.getBoundingClientRect().height * 10) / 10,
      contentCS: getComputedStyle(f, '::details-content').contentVisibility,
      bodyAnim: getComputedStyle(b).animationName,
      chevron: getComputedStyle(s, '::before').transform,
      overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    };
  };

  // 折叠区内每个控件的可读性
  const inner = () => {
    const f = document.querySelector('.fold');
    const items = [...f.querySelectorAll('input,label,summary')].map((e) => {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return {
        tag: e.tagName,
        text: (e.value || e.textContent || '').trim().slice(0, 28),
        fs: cs.fontSize,
        lh: cs.lineHeight,
        color: cs.color,
        w: Math.round(r.width),
        overflow: e.scrollWidth > e.clientWidth + 1,
      };
    });
    return items;
  };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  out.reducedMotionActive = reduced;

  const f = document.querySelector('.fold');
  if (!f) return { error: 'no .fold' };
  f.scrollIntoView({ block: 'center' });
  await sleep(400);

  // 关 → 开
  f.open = false;
  await sleep(500);
  out.closed = geom();

  f.open = true;
  await sleep(700);
  out.open = geom();
  out.innerItems = inner();

  // 连点两次（中断测试）
  f.open = false;
  await sleep(120);
  f.open = true;
  await sleep(120);
  f.open = false;
  await sleep(60);
  f.open = true;
  await sleep(700);
  out.afterRapidToggle = geom();

  // 键盘：从 summary 用 Space
  f.open = false;
  await sleep(500);
  f.querySelector('summary').focus();
  out.keyboardFocusOutline = (() => {
    const cs = getComputedStyle(f.querySelector('summary'));
    return cs.outlineWidth + ' ' + cs.outlineStyle + ' ' + cs.outlineColor + ' offset=' + cs.outlineOffset;
  })();

  // 抽屉内部输入框的真实可用性。模型名已经搬出这个抽屉，现在里面是温度/最大输出。
  f.open = true;
  await sleep(600);
  const input = document.querySelector('#o-temp');
  input.focus();
  out.inputFocusable = document.activeElement === input;
  input.value = '0.7';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(200);
  out.inputAcceptsText = input.value;
  out.inputOverflow = input.scrollWidth > input.clientWidth + 1;

  // 模型名必须在抽屉**外面**（它是必填输入，不是「这一家之外的临时覆盖」）
  const modelInput = document.querySelector('#o-model');
  out.modelInputOutsideFold = Boolean(modelInput) && !f.contains(modelInput);

  return out;
})()
