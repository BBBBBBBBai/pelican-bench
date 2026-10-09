(() => {
  const out = {};
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const R = (el) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, x: Math.round(r.x), y: Math.round(r.y) };
  };
  const lum = (c) => {
    const m = c.match(/\d+(\.\d+)?/g);
    if (!m) return null;
    const [r, g, b] = m.slice(0, 3).map(Number).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (fg, bg) => {
    const a = lum(fg), b = lum(bg);
    if (a === null || b === null) return null;
    const [hi, lo] = a > b ? [a, b] : [b, a];
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  // 沿祖先找第一个非透明背景
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = cs(n).backgroundColor;
      if (c && !/rgba?\(0, 0, 0, 0\)/.test(c)) return c;
      n = n.parentElement;
    }
    return cs(document.body).backgroundColor;
  };

  out.viewport = { w: window.innerWidth, h: window.innerHeight };

  // 1) 布局：右栏、主按钮、凹槽
  const panel = document.querySelector('.panel');
  const bay = document.querySelector('.bay');
  const arm = document.querySelector('.arm');
  const slot = document.querySelector('.mp-slot');
  const grid = document.querySelector('.mp-grid');
  const foot = document.querySelector('.mp-foot');
  const status = document.querySelector('.mp-status');
  out.layout = {
    panel: panel ? R(panel) : null,
    bay: bay ? R(bay) : null,
    arm: arm ? { ...R(arm), text: (arm.textContent || '').trim(), disabled: arm.disabled } : null,
    slot: slot ? R(slot) : null,
    grid: grid ? R(grid) : null,
    foot: foot ? { ...R(foot), text: (foot.textContent || '').trim() } : null,
    status: status ? { ...R(status), text: (status.textContent || '').trim() } : null,
    cells: document.querySelectorAll('#mp-grid .mp-cell').length,
    docOverflowsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    docH: document.documentElement.scrollHeight,
  };

  // 2) 断点归属
  out.breakpoints = {
    rightCol348: window.matchMedia('(min-width: 1041px)').matches,
    stacked: window.matchMedia('(max-width: 1040px)').matches,
    narrow: window.matchMedia('(max-width: 900px)').matches,
    phone: window.matchMedia('(max-width: 620px)').matches,
    coarse: window.matchMedia('(pointer: coarse)').matches,
    reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    dark: window.matchMedia('(prefers-color-scheme: dark)').matches,
  };

  // 3) 真实溢出（矩形逃出父盒，且没有省略号兜着）
  const leaves = document.querySelectorAll(
    '.ch-silk *, .slot-name, .slot-sub, .read, .silk, .note, .pathline, .mp-name, .mp-input, .mp-foot span, .mp-status, .preset-name, .tag, .prompt-line *, .stream-head *',
  );
  const escapes = [];
  for (const el of leaves) {
    if (!el.textContent || !el.textContent.trim()) continue;
    const st = cs(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    if (el.closest('.mp-empty') && el.className !== 'mp-empty') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const p = el.parentElement;
    if (!p) continue;
    const pr = p.getBoundingClientRect();
    if (pr.width === 0) continue;
    const overflowHidden = st.overflow === 'hidden' || st.overflowX === 'hidden';
    const ellipsis = st.textOverflow === 'ellipsis';
    if (r.right > pr.right + 1.5 || r.left < pr.left - 1.5) {
      escapes.push({
        cls: typeof el.className === 'string' ? el.className : el.tagName,
        over: Math.round(Math.max(r.right - pr.right, pr.left - r.left)),
        guarded: overflowHidden || ellipsis,
      });
    }
  }
  out.escapes = escapes.slice(0, 14);
  out.escapeCount = escapes.length;
  out.unguarded = escapes.filter((e) => !e.guarded).length;

  // 4) 关键文字的对比度
  const targets = [
    ['.silk-hi', 'panel'],
    ['.note', 'panel'],
    ['.slot-name', 'panel'],
    ['.slot-sub', 'panel'],
    ['.mp-name', 'well'],
    ['.mp-foot span', 'slot'],
    ['.mp-status', 'panel'],
    ['.read', 'panel'],
    ['.tag', 'panel'],
    ['.pathline', 'panel'],
  ];
  out.contrast = targets.map(([sel, where]) => {
    const el = document.querySelector(sel);
    if (!el) return { sel, missing: true };
    const st = cs(el);
    const bg = bgOf(el);
    const px = parseFloat(st.fontSize);
    const bold = Number(st.fontWeight) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const r = ratio(st.color, bg);
    return {
      sel,
      where,
      size: st.fontSize,
      color: st.color,
      bg,
      ratio: r,
      need: large ? 3 : 4.5,
      pass: r !== null && r >= (large ? 3 : 4.5),
    };
  });

  // 5) 可聚焦元素清单 + 触控尺寸
  const focusables = [
    ...document.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'),
  ].filter((el) => {
    const st = cs(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && !el.disabled;
  });
  out.focusables = {
    count: focusables.length,
    small: focusables
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          cls: typeof el.className === 'string' ? el.className : '',
          id: el.id || null,
          label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 22),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      })
      .filter((x) => x.w > 0 && (x.h < 24 || x.w < 24)),
  };

  // 6) 焦点环是否真的可见（逐个 focus 一遍，看 outline）
  const ringReport = [];
  for (const el of focusables.slice(0, 40)) {
    el.focus();
    if (document.activeElement !== el) continue;
    const st = cs(el);
    const has = st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0;
    const shadow = st.boxShadow && st.boxShadow !== 'none';
    if (!has && !shadow) {
      ringReport.push({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === 'string' ? el.className : '',
        label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 22),
      });
    }
  }
  out.noFocusRing = ringReport;
  document.activeElement?.blur?.();

  // 7) 控制台错误（由 driver 的 console 通道填；这里只报 window.onerror 计数）
  out.errors = window.__polishErrors ?? null;

  return out;
})()
