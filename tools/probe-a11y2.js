(async () => {
  const out = {};
  const q = (s) => Array.from(document.querySelectorAll(s));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };

  // ---------- the mystery div with an onclick attribute ----------
  out.divOnclick = q('div').filter((e) => e.onclick).map((e) => ({
    cls: e.className.toString(), parent: e.parentElement ? e.parentElement.className.toString() : null,
    role: e.getAttribute('role'), tabindex: e.getAttribute('tabindex'), label: e.getAttribute('aria-label'),
  }));

  // ---------- accessible name of a rack cell ----------
  const cell = q('.ch')[0];
  out.cell = cell ? {
    tag: cell.tagName, cls: cell.className.toString(),
    innerText: (cell.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90),
    ariaLabel: cell.getAttribute('aria-label'), ariaPressed: cell.getAttribute('aria-pressed'),
    hasImg: !!cell.querySelector('img'), imgAlt: cell.querySelector('img') ? cell.querySelector('img').getAttribute('alt') : null,
    titled: !!cell.getAttribute('title'),
  } : null;

  // ---------- landmarks: what are the <section> elements? ----------
  out.sections = q('section').map((e) => ({
    cls: e.className.toString(), label: e.getAttribute('aria-label'), labelledby: e.getAttribute('aria-labelledby'),
    headingInside: (e.innerText || '').split('\n')[0].slice(0, 30),
  }));
  out.mainCount = q('main').length;
  out.benchTag = document.querySelector('.bench') ? document.querySelector('.bench').tagName : null;
  out.railTag = document.querySelector('.rail') ? document.querySelector('.rail').tagName : null;
  out.panelTag = document.querySelector('.panel') ? document.querySelector('.panel').tagName : null;

  // ---------- scroll containers: keyboard reachable? ----------
  out.scrollReach = q('.rack-scroll, .panel-scroll, .sheet-main, .sheet-facts').map((e) => ({
    cls: e.className.toString(), tabindex: e.getAttribute('tabindex'),
    scrollable: e.scrollHeight > e.clientHeight + 2, reachable: e.tabIndex >= 0,
  }));

  // ---------- focus-visible: simulate a real keyboard Tab ----------
  // Blur first, then walk focus forward with dispatched Tab keydowns; Chromium flips
  // :focus-visible on when the focus move originates from the keyboard.
  document.body.focus();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  const seen = [];
  for (let i = 0; i < 6; i++) {
    const before = document.activeElement;
    const ev = new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true, cancelable: true });
    (before || document.body).dispatchEvent(ev);
    // move focus manually since synthetic Tab does not move focus
    const all = q('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])').filter((e) => !e.disabled && e.offsetParent !== null);
    const idx = all.indexOf(before);
    const next = all[idx + 1];
    if (!next) break;
    next.focus();
    const cs = getComputedStyle(next);
    seen.push({
      i, cls: (next.className.toString() || next.tagName).slice(0, 30),
      focusVisible: next.matches(':focus-visible'),
      outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor,
      offset: cs.outlineOffset, boxShadow: cs.boxShadow.slice(0, 40),
    });
  }
  out.tabWalk = seen;

  // ---------- open the specimen sheet and probe it ----------
  if (cell) { cell.click(); await wait(1500); }
  const sheet = document.querySelector('.sheet');
  out.sheet = sheet ? {
    tag: sheet.tagName, cls: sheet.className.toString(),
    role: sheet.getAttribute('role'), ariaModal: sheet.getAttribute('aria-modal'), ariaLabel: sheet.getAttribute('aria-label'),
    ariaLabelledby: sheet.getAttribute('aria-labelledby'),
    focusAfterOpen: document.activeElement.tagName + '.' + document.activeElement.className.toString().slice(0, 40),
    focusInsideSheet: sheet.contains(document.activeElement),
    bodyOverflowHidden: getComputedStyle(document.body).overflow,
    rootAriaHidden: document.getElementById('root') ? document.getElementById('root').getAttribute('aria-hidden') : null,
    backgroundInert: document.querySelector('.bench') ? document.querySelector('.bench').inert : null,
    closeBtn: (() => { const b = sheet.querySelector('button'); return b ? { cls: b.className.toString().slice(0, 30), name: (b.innerText || '').trim().slice(0, 30), aria: b.getAttribute('aria-label') } : null; })(),
    headingsInside: Array.from(sheet.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')).map((h) => (h.innerText || '').trim().slice(0, 24)),
    iframes: sheet.querySelectorAll('iframe').length,
    liveRegions: Array.from(sheet.querySelectorAll('[aria-live],[role=status],[role=alert]')).length,
    factsTerms: Array.from(sheet.querySelectorAll('.facts dt')).slice(0, 3).map((d) => (d.innerText || '').trim()),
    dtTag: sheet.querySelector('.facts dt') ? sheet.querySelector('.facts dt').tagName : null,
    factsListTag: sheet.querySelector('.facts') ? sheet.querySelector('.facts').tagName : null,
    summaryTag: sheet.querySelector('.fold > summary') ? sheet.querySelector('.fold > summary').parentElement.tagName : null,
  } : null;

  // tab order inside the sheet: does focus escape to the page behind it?
  const focusables = () => q('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])').filter((e) => !e.disabled && e.offsetParent !== null);
  const startIdx = focusables().indexOf(document.activeElement);
  const escaped = [];
  let cur = document.activeElement;
  for (let i = 0; i < 40; i++) {
    const all = focusables();
    const nxt = all[all.indexOf(cur) + 1];
    if (!nxt) break;
    nxt.focus();
    cur = nxt;
    if (sheet && !sheet.contains(cur)) { escaped.push((cur.className.toString() || cur.tagName).slice(0, 30) + ' :: ' + (cur.innerText || '').trim().slice(0, 20)); }
  }
  out.focusEscapesSheet = escaped.slice(0, 8);
  out.focusEscapeCount = escaped.length;

  // ---------- Escape key: does the sheet close? ----------
  const escEv = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true });
  (document.activeElement || document.body).dispatchEvent(escEv);
  document.dispatchEvent(escEv);
  await wait(500);
  out.sheetClosedOnEscape = !document.querySelector('.sheet');
  out.focusAfterEscape = document.activeElement ? document.activeElement.tagName + '.' + document.activeElement.className.toString().slice(0, 40) : null;

  // ---------- toast: announced? ----------
  out.toastLive = q('.toast').map((e) => ({ cls: e.className.toString(), live: e.getAttribute('aria-live'), role: e.getAttribute('role') }));

  return out;
})()
