(async () => {
  const out = { before: {}, en: {}, zh: {} };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const rect = (el) => { const b = el.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), top: +b.top.toFixed(1) }; };
  const escapes = (el) => {
    const p = el.parentElement; if (!p) return false;
    const a = el.getBoundingClientRect(), b = p.getBoundingClientRect();
    return a.right > b.right + 1 || a.left < b.left - 1;
  };
  const isLeaf = (e) => !e.children.length && e.textContent.trim();

  const snapshot = (tag) => {
    const s = { tag, lang: document.documentElement.lang };
    s.docScrollW = document.documentElement.scrollWidth;
    s.docClientW = document.documentElement.clientWidth;
    s.docOverflowsX = s.docScrollW > s.docClientW + 1;
    const col = q('.bay') || q('.panel');
    s.col = col ? rect(col) : null;
    // 右栏每个 field 的高度 —— 英文文案变长会不会把右栏撑高
    s.fields = qa('.field').map((f) => {
      const lab = q('label', f);
      return { label: lab ? lab.textContent.trim().slice(0, 24) : null, h: +f.getBoundingClientRect().height.toFixed(1) };
    });
    // 门禁按钮 + 状态行
    const arm = q('.arm');
    s.arm = arm ? { text: arm.textContent.trim(), title: arm.title, disabled: arm.disabled, box: rect(arm) } : null;
    const st = q('.mp-status');
    s.mpStatus = st ? { text: st.textContent.trim(), box: rect(st), scrollW: st.scrollWidth, clientW: st.clientWidth, clipped: st.scrollWidth > st.clientWidth + 1 } : null;
    const foot = q('.mp-foot');
    s.mpFoot = foot ? { text: foot.textContent.trim(), box: rect(foot) } : null;
    const hint = q('#o-model-hint');
    s.hint = hint ? { text: hint.textContent.trim().slice(0, 90), box: rect(hint) } : null;
    // 任何叶子横向逃逸
    const bad = [];
    for (const el of qa('.panel *, .bay *').filter(isLeaf)) {
      if (escapes(el) || (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis' && getComputedStyle(el).overflowX === 'visible')) {
        bad.push({ cls: el.className || el.tagName, text: el.textContent.slice(0, 50), scrollW: el.scrollWidth, clientW: el.clientWidth, esc: escapes(el) });
      }
    }
    s.escapes = bad.slice(0, 25); s.escapeCount = bad.length;
    // 机架行数（换行会不会改变可见条数）
    s.tiles = qa('.ch').length;
    const g = q('.rack-grid');
    s.gridH = g ? +g.getBoundingClientRect().height.toFixed(1) : null;
    return s;
  };

  out.before = snapshot('before');

  const btns = qa('.sw button');
  out.swButtons = btns.map((b) => ({ text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed'), cls: b.className }));
  const enBtn = btns.find((b) => /EN/i.test(b.textContent));
  const zhBtn = btns.find((b) => /中/.test(b.textContent));
  if (enBtn) {
    enBtn.click();
    await wait(800);
    out.en = snapshot('en');
    // 英文下再多量两个会变长的文案容器
    const note = q('#o-model-hint');
    if (note) { out.en.hintLines = Math.round(note.getBoundingClientRect().height / parseFloat(getComputedStyle(note).lineHeight || '20')); }
    const slotSubs = qa('.slot-sub').map((e) => ({ text: e.textContent.slice(0, 40), h: +e.getBoundingClientRect().height.toFixed(1), lines: Math.round(e.getBoundingClientRect().height / (parseFloat(getComputedStyle(e).lineHeight) || 15)) }));
    out.en.slotSubs = slotSubs;
    if (zhBtn) { zhBtn.click(); await wait(800); out.zh = snapshot('zh'); }
  } else { out.en = { skipped: 'no EN button' }; }

  // 本地存储里有没有被静默吞掉的失败（uiLang 保存失败会静默回退）
  out.langRoundTrip = { after: document.documentElement.lang };

  return out;
})()
