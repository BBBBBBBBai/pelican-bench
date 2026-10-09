(async () => {
  const out = {};
  const q = (s) => Array.from(document.querySelectorAll(s));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- 1. is the mystery onclick div just React's root container? ----
  out.onclickDivs = q('div').filter((e) => e.onclick).map((e) => ({
    id: e.id, cls: e.className.toString(), parentTag: e.parentElement.tagName,
    isRoot: e.id === 'root', childCount: e.children.length,
  }));

  // ---- 2. accessible name of the sheet close button (does title count?) ----
  const btn = document.querySelector('.sheet-head .btn.icon') || q('.btn.icon')[0];
  out.closeBtn = btn ? {
    title: btn.getAttribute('title'), ariaLabel: btn.getAttribute('aria-label'),
    innerText: (btn.innerText || '').trim(), hasSvg: !!btn.querySelector('svg'),
    // title IS the accname fallback per accname spec step 2I
    effectiveNameSource: btn.getAttribute('aria-label') ? 'aria-label' : ((btn.innerText || '').trim() ? 'content' : (btn.getAttribute('title') ? 'title' : 'NONE')),
  } : null;

  // ---- 3. :focus-visible declarations present? ----
  const rules = [];
  for (const ss of Array.from(document.styleSheets)) {
    let rs; try { rs = Array.from(ss.cssRules); } catch (e) { continue; }
    for (const r of rs) {
      if (r.selectorText && r.selectorText.includes('focus-visible')) {
        rules.push({ sel: r.selectorText, css: r.style.cssText.slice(0, 120) });
      }
    }
  }
  out.focusVisibleRules = rules;

  // ---- 4. prefers-reduced-motion: what does the app DO when it is on? ----
  // Reproduce the block's effect without a real media flip: read the two animated things.
  out.animated = q('*').filter((e) => {
    const cs = getComputedStyle(e);
    return cs.animationName && cs.animationName !== 'none';
  }).map((e) => ({ cls: e.className.toString().slice(0, 40), name: getComputedStyle(e).animationName, dur: getComputedStyle(e).animationDuration }));
  const lamp = document.querySelector('.lamp');
  out.lampBoxShadow = lamp ? getComputedStyle(lamp).boxShadow.slice(0, 80) : null;

  // ---- 5. text scaling: does the layout survive a root font bump? ----
  const res = {};
  const sizes = [16, 20, 24, 32];
  for (const px of sizes) {
    document.documentElement.style.fontSize = px + 'px';
    await wait(120);
    const cells = q('.ch');
    res['root' + px] = {
      docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      clipped: q('*').filter((e) => e.scrollWidth > e.clientWidth + 2 && !['auto', 'scroll'].includes(getComputedStyle(e).overflowX)).length,
      cellH: cells[0] ? Math.round(cells[0].getBoundingClientRect().height) : null,
      railH: document.querySelector('.rail') ? Math.round(document.querySelector('.rail').getBoundingClientRect().height) : null,
    };
  }
  document.documentElement.style.fontSize = '';
  await wait(120);
  out.textScale = res;

  // ---- 6. does any element use a px font-size on a container that scaling would miss? ----
  // (px font-size does NOT respond to the browser's default-font-size setting)
  out.pxFontSizes = (() => {
    const counts = {};
    q('*').forEach((e) => {
      const fs = getComputedStyle(e).fontSize;
      counts[fs] = (counts[fs] || 0) + 1;
    });
    return counts;
  })();

  // ---- 7. contrast re-check at the current state, incl. placeholder + focus ring ----
  const lum = (c) => {
    const m = c.match(/\d+(\.\d+)?/g); if (!m) return null;
    const [r, g, b] = m.slice(0, 3).map(Number).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba?\(0, 0, 0, 0\)/.test(c)) return c;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  out.contrast = q('.note, .pathline, .silk, .read, .tag, .slot-sub, .ch-model, .ch-when, .field > label').slice(0, 30).map((e) => {
    const cs = getComputedStyle(e); const bg = bgOf(e);
    const l1 = lum(cs.color); const l2 = lum(bg);
    if (l1 == null || l2 == null) return null;
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return { cls: e.className.toString().slice(0, 30), size: cs.fontSize, ratio: Math.round(ratio * 100) / 100 };
  }).filter(Boolean).filter((x) => x.ratio < 4.5);

  // ---- 8. the plate/iframe: is the specimen SVG sandboxed? ----
  const ifr = document.querySelector('.sheet iframe');
  out.iframe = ifr ? { sandbox: ifr.getAttribute('sandbox'), src: (ifr.getAttribute('src') || '').slice(0, 40), title: ifr.getAttribute('title'), csp: ifr.getAttribute('csp') } : null;

  return out;
})()
