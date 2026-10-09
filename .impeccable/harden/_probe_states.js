(async () => {
  const out = { notes: [], en: [], scale: {}, states: {} };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const rect = (el) => { const b = el.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
  const overflows = (el) => el.scrollWidth > el.clientWidth + 1;

  // ── 1. 谁在单行截断，谁在横向逃逸（只报「逃逸」，截断是设计）
  const escapes = (el) => {
    const p = el.parentElement; if (!p) return false;
    const a = el.getBoundingClientRect(), b = p.getBoundingClientRect();
    return a.right > b.right + 1 || a.left < b.left - 1;
  };
  const walker = qa('.ch-silk *, .ch-head *, .slot-name, .slot-sub, .rail-cur, .read, .prov-receipt, .mp-name, .mp-input, .preset-name, .tag');
  const seen = new Set();
  for (const el of walker) {
    if (el.children.length) continue;
    if (!el.textContent.trim()) continue;
    if (escapes(el) || (overflows(el) && !/(ellipsis)/.test(getComputedStyle(el).textOverflow))) {
      const key = el.className + '|' + getComputedStyle(el).textOverflow;
      if (seen.has(key)) continue; seen.add(key);
      out.notes.push({
        cls: el.className, text: el.textContent.slice(0, 40),
        scrollW: el.scrollWidth, clientW: el.clientWidth,
        textOverflow: getComputedStyle(el).textOverflow,
        overflow: getComputedStyle(el).overflow, escapes: escapes(el),
      });
    }
  }

  // ── 2. 英文下的右栏：切到 EN 量一遍
  const langBtn = qa('.sw button').find((b) => /EN/i.test(b.textContent));
  if (langBtn) {
    langBtn.click();
    await wait(600);
    out.en.langNow = document.documentElement.lang;
    const panel = q('.panel') || q('.control');
    out.en.panel = panel ? rect(panel) : null;
    // 右栏内所有叶子节点的横向逃逸
    const leaves = qa('.panel *, .bay-head *, .field *').filter((e) => !e.children.length && e.textContent.trim());
    const bad = [];
    for (const el of leaves) {
      if (escapes(el) || (overflows(el) && getComputedStyle(el).textOverflow !== 'ellipsis')) {
        bad.push({ cls: el.className, tag: el.tagName, text: el.textContent.slice(0, 46), scrollW: el.scrollWidth, clientW: el.clientWidth, esc: escapes(el) });
      }
    }
    out.en.escapes = bad.slice(0, 30);
    out.en.escapeCount = bad.length;
    out.en.docScrollW = document.documentElement.scrollWidth;
    out.en.docClientW = document.documentElement.clientWidth;
    // 门禁按钮文案
    const arm = q('.arm');
    out.en.arm = arm ? { text: arm.textContent, title: arm.title, disabled: arm.disabled } : null;
    const status = q('.mp-status');
    out.en.mpStatus = status ? { text: status.textContent, box: rect(status), scrollW: status.scrollWidth, clientW: status.clientWidth } : null;
    // 切回中文
    const zhBtn = qa('.sw button').find((b) => /中/.test(b.textContent));
    if (zhBtn) { zhBtn.click(); await wait(600); }
    out.en.backTo = document.documentElement.lang;
  } else out.en.skipped = 'no EN button';

  // ── 3. 数据规模：把机架格复制到 N，量布局代价
  const grid = q('.rack-grid');
  const tiles = qa('.ch');
  if (grid && tiles.length) {
    out.scale.base = tiles.length;
    const measure = (n) => {
      const t0 = performance.now();
      const frag = document.createDocumentFragment();
      for (let i = 0; i < n; i++) {
        const c = tiles[i % tiles.length].cloneNode(true);
        c.setAttribute('data-clone', '1');
        frag.appendChild(c);
      }
      grid.appendChild(frag);
      void grid.offsetHeight; // 强制同步布局
      const t1 = performance.now();
      return +(t1 - t0).toFixed(1);
    };
    out.scale.cloneMs200 = measure(200);
    out.scale.cloneMs500 = measure(500);
    out.scale.cloneMs1000 = measure(1000);
    void document.documentElement.offsetHeight;
    out.scale.totalTiles = qa('.ch').length;
    out.scale.docHeight = document.documentElement.scrollHeight;
    out.scale.imgCount = qa('.ch-plate img').length;
    qa('[data-clone]').forEach((e) => e.remove());
    out.scale.restored = qa('.ch').length;
  }

  // ── 4. 状态盘点：现在页面里有哪些「空 / 无」提示
  out.states.emptyBlocks = qa('.empty').map((e) => ({ cls: e.className, text: e.textContent.trim().slice(0, 80), box: rect(e) }));
  out.states.toastPresent = Boolean(q('.toast'));
  out.states.liveRegions = qa('[role="status"], [aria-live]').map((e) => ({
    tag: e.tagName, cls: e.className, role: e.getAttribute('role'),
    live: e.getAttribute('aria-live'), text: e.textContent.trim().slice(0, 40),
    offscreen: getComputedStyle(e).position === 'absolute' && e.getBoundingClientRect().left < -1000,
  }));
  out.states.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return out;
})()
