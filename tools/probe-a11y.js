(async () => {
  const out = {};
  const q = (s) => Array.from(document.querySelectorAll(s));
  const nm = (el) => {
    if (!el) return null;
    const al = el.getAttribute('aria-label');
    if (al) return 'aria-label:' + al;
    const lb = el.getAttribute('aria-labelledby');
    if (lb) return 'aria-labelledby:' + lb;
    const t = (el.innerText || el.textContent || '').trim();
    if (t) return 'text:' + t.slice(0, 40);
    const ti = el.getAttribute('title');
    if (ti) return 'title:' + ti;
    return null;
  };

  // ---- landmarks / headings ----
  out.landmarks = {
    main: q('main').length, nav: q('nav').length, header: q('header').length,
    aside: q('aside').length, section: q('section').length, footer: q('footer').length,
  };
  out.headings = q('h1,h2,h3,h4,h5,h6').map((h) => h.tagName + ':' + (h.innerText || '').trim().slice(0, 30));
  out.roleHeading = q('[role=heading]').length;
  out.htmlLang = document.documentElement.lang;

  // ---- interactive elements with no accessible name ----
  const interactive = q('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role=button], [role=switch]');
  out.interactiveCount = interactive.length;
  out.nameless = interactive.filter((e) => !nm(e)).map((e) => e.tagName + '.' + e.className.toString().slice(0, 50));
  out.iconOnly = interactive.filter((e) => {
    const t = (e.innerText || '').trim();
    return !t && e.querySelector('svg');
  }).map((e) => ({ cls: e.className.toString().slice(0, 45), name: nm(e) }));

  // ---- click handlers on non-interactive elements ----
  const nonInteractiveClick = [];
  q('div, span, li, img, section').forEach((e) => {
    if (e.onclick) nonInteractiveClick.push(e.tagName + '.' + e.className.toString().slice(0, 40));
  });
  out.nonInteractiveClick = nonInteractiveClick;

  // ---- toggle / disclosure state ----
  out.ariaPressed = q('[aria-pressed]').map((e) => ({ cls: e.className.toString().slice(0, 40), v: e.getAttribute('aria-pressed') }));
  out.pressedOnSwitchGroup = q('.sw > button').map((e) => ({ txt: (e.innerText || '').trim(), pressed: e.getAttribute('aria-pressed'), role: e.getAttribute('role') }));
  out.groupRole = q('.sw, .detents, .rail-group').map((e) => ({ cls: e.className.toString().slice(0, 30), role: e.getAttribute('role'), label: e.getAttribute('aria-label') }));
  out.detents = q('.detents > button').slice(0, 3).map((e) => ({ txt: (e.innerText || '').trim().slice(0, 20), pressed: e.getAttribute('aria-pressed') }));
  out.foldSummaries = q('.fold > summary').map((e) => ({ txt: (e.innerText || '').trim().slice(0, 20), aria: e.getAttribute('aria-expanded'), tag: e.tagName }));
  out.checkboxes = q('.check input').map((e) => {
    const lab = e.closest('label');
    return { type: e.type, id: e.id || null, inLabel: !!lab, labelText: lab ? (lab.innerText || '').trim().slice(0, 30) : null, aria: e.getAttribute('aria-label') };
  });
  out.inputs = q('input[type=text],input[type=password],input[type=number],select,textarea').map((e) => {
    const id = e.id || null;
    const forLbl = id ? document.querySelector('label[for="' + id + '"]') : null;
    const wrap = e.closest('label');
    const aria = e.getAttribute('aria-label');
    const near = e.previousElementSibling && e.previousElementSibling.tagName === 'LABEL' ? e.previousElementSibling : null;
    return { tag: e.tagName, type: e.type || null, id, hasFor: !!forLbl, inLabel: !!wrap, aria, prevLabel: near ? (near.innerText || '').trim().slice(0, 25) : null };
  });

  // ---- images ----
  out.imgs = q('img').slice(0, 4).map((e) => {
    const r = e.getBoundingClientRect();
    return { alt: e.getAttribute('alt'), hasAltAttr: e.hasAttribute('alt'), loading: e.getAttribute('loading'), decoding: e.getAttribute('decoding'), w: Math.round(r.width), h: Math.round(r.height), srcKind: (e.src || '').slice(0, 12) };
  });
  out.imgCount = q('img').length;
  out.imgEager = q('img:not([loading=lazy])').length;
  out.iframeCount = q('iframe').length;
  out.iframeAttrs = q('iframe').slice(0, 2).map((e) => ({ title: e.getAttribute('title'), sandbox: e.getAttribute('sandbox'), src: (e.getAttribute('src') || '').slice(0, 24) }));

  // ---- live regions ----
  out.liveRegions = q('[aria-live], [role=status], [role=alert]').map((e) => ({ cls: e.className.toString().slice(0, 40), live: e.getAttribute('aria-live'), role: e.getAttribute('role') }));

  // ---- focus visibility at runtime ----
  const firstBtn = q('.ch')[0];
  if (firstBtn) {
    firstBtn.focus();
    const cs = getComputedStyle(firstBtn);
    out.focusRing = { outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor, outlineOffset: cs.outlineOffset };
    out.focusedTag = document.activeElement.tagName + '.' + document.activeElement.className.toString().slice(0, 30);
  }
  out.reducedMotionRule = Array.from(document.styleSheets).some((ss) => {
    try { return Array.from(ss.cssRules).some((r) => r.conditionText && r.conditionText.includes('prefers-reduced-motion')); } catch (e) { return false; }
  });

  // ---- scroll containers / overflow ----
  out.docOverflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  out.scrollers = q('*').filter((e) => {
    const cs = getComputedStyle(e);
    return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 2;
  }).slice(0, 8).map((e) => ({ cls: e.className.toString().slice(0, 40), sh: e.scrollHeight, ch: e.clientHeight }));

  // ---- button hit areas below 24px ----
  out.tiny = interactive.map((e) => {
    const r = e.getBoundingClientRect();
    return { cls: e.className.toString().slice(0, 45), w: Math.round(r.width), h: Math.round(r.height), txt: (e.innerText || '').trim().slice(0, 14) };
  }).filter((x) => x.w > 0 && x.h > 0 && (x.w < 24 || x.h < 24));

  return out;
})()
