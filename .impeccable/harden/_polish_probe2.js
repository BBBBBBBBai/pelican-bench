(async () => {
  const out = {};
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const desc = (el) => ({
    tag: el.tagName.toLowerCase(),
    cls: typeof el.className === 'string' ? el.className : '',
    id: el.id || null,
    label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20),
  });

  // 让 :focus-visible 真的生效：Chromium 的判定是「最近一次交互是不是键盘」，
  // 所以在 focus() 之前先派一个真的 keydown。这样脚本焦点也会被算作键盘焦点。
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

  const all = [
    ...document.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'),
  ].filter((el) => {
    const st = cs(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && !el.disabled;
  });

  const noRing = [];
  let checked = 0;
  let fvMatched = 0;
  for (const el of all) {
    el.focus();
    if (document.activeElement !== el) continue;
    checked += 1;
    const st = cs(el);
    const isFV = el.matches(':focus-visible');
    if (isFV) fvMatched += 1;
    const outline = st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0;
    const shadow = st.boxShadow && st.boxShadow !== 'none';
    const borderChanged = st.borderTopColor && st.borderTopColor.includes('240, 160, 32');
    if (!outline && !shadow && !borderChanged) noRing.push({ ...desc(el), isFV });
  }
  out.focus = { total: all.length, checked, fvMatched, noRing };
  document.activeElement?.blur?.();

  // 输入框焦点环具体长什么样（拿最典型的两个）
  const sample = {};
  for (const sel of ['#o-model', '#f-name', '.preset-name', '.mp-cell']) {
    const el = document.querySelector(sel);
    if (!el) continue;
    el.focus();
    const st = cs(el);
    sample[sel] = {
      matchesFV: el.matches(':focus-visible'),
      outline: `${st.outlineStyle} ${st.outlineWidth} ${st.outlineColor}`,
      outlineOffset: st.outlineOffset,
      boxShadow: st.boxShadow,
      borderTopColor: st.borderTopColor,
    };
  }
  out.focusSample = sample;
  document.activeElement?.blur?.();

  // 手指档：槽高、行高、回执条
  out.coarse = {
    isCoarse: window.matchMedia('(pointer: coarse)').matches,
    slot: document.querySelector('.mp-slot')?.getBoundingClientRect().height ?? null,
    slotMax: cs(document.querySelector('.mp-slot'))?.maxBlockSize ?? null,
    gridMax: cs(document.querySelector('.mp-grid'))?.maxBlockSize ?? null,
    cell: document.querySelector('.mp-cell')?.getBoundingClientRect().height ?? null,
    clear: document.querySelector('.mp-clear')?.getBoundingClientRect().width ?? null,
    foot: document.querySelector('.mp-foot')?.getBoundingClientRect().height ?? null,
    denseBtn: (() => {
      const b = [...document.querySelectorAll('.btn.dense')].find((x) =>
        /恢复|RESET/.test(x.textContent || ''),
      );
      return b ? { h: b.getBoundingClientRect().height, minH: cs(b).minHeight } : null;
    })(),
  };

  // 减动效档：三个编排动作是否真的被压掉
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lamp = document.querySelector('.lamp');
  out.motion = {
    reduce,
    lampAnimation: lamp ? cs(lamp).animationDuration : null,
    btnTransition: cs(document.querySelector('.btn'))?.transitionDuration ?? null,
  };

  // 页面上还有几个 live region
  out.liveRegions = [...document.querySelectorAll('[role="status"],[aria-live]')].map((el) => ({
    cls: typeof el.className === 'string' ? el.className : '',
    text: (el.textContent || '').trim().slice(0, 40),
    w: Math.round(el.getBoundingClientRect().width),
  }));

  // 空态那句话现在是不是唯一的播报
  out.emptyHasStatus = !!document.querySelector('.mp-empty[role="status"]');
  out.footHasStatus = !!document.querySelector('.mp-foot [role="status"]');

  return out;
})()
