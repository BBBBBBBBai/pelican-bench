(async () => {
  const out = { notes: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (sel, ms = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const el = document.querySelector(sel); if (el) return el; await sleep(100); }
    return null;
  };

  const fold = await waitFor('details.fold');
  if (!fold) { out.notes.push('no fold'); return out; }
  fold.open = true;
  await sleep(300);

  const measure = (tag) => {
    const sw = fold.querySelector('.effort-row .sw');
    const body = fold.querySelector('.fold-body');
    const hint = fold.querySelectorAll('.fold-body .note');
    const bb = body.getBoundingClientRect();
    const sb = sw.getBoundingClientRect();
    return {
      tag,
      swW: +sb.width.toFixed(1),
      bodyW: +bb.width.toFixed(1),
      slack: +(bb.right - sb.right).toFixed(1),
      escapes: sb.right > bb.right + 0.5,
      wraps: [...sw.querySelectorAll('button')].some((b) => b.getBoundingClientRect().top > sb.top + 1),
      bodyScrollW: body.scrollWidth,
      bodyClientW: body.clientWidth,
      docOverflowsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      notes: [...hint].map((n) => n.textContent.trim().slice(0, 30)),
      summary: fold.querySelector('summary').textContent.trim(),
    };
  };

  out.zh = measure('zh');

  // 切到 EN：语言开关是 BusBar 里那个 label="language" 的 .sw
  // （不能按「中」找 —— 字号开关也有「中」）
  const langSw = [...document.querySelectorAll('.sw')].find((s) =>
    [...s.querySelectorAll('button')].some((b) => b.textContent.trim() === 'EN'),
  );
  if (!langSw) { out.notes.push('no EN switch'); return out; }
  out.langSwFound = true;
  [...langSw.querySelectorAll('button')].find((b) => b.textContent.trim() === 'EN').click();
  await sleep(800);
  // 语言切换会重渲染，重新拿 fold
  const fold2 = document.querySelector('details.fold');
  fold2.open = true;
  await sleep(400);
  const sw2 = fold2.querySelector('.effort-row .sw');
  const body2 = fold2.querySelector('.fold-body');
  const bb2 = body2.getBoundingClientRect();
  const sb2 = sw2.getBoundingClientRect();
  out.en = {
    tag: 'en',
    swW: +sb2.width.toFixed(1),
    bodyW: +bb2.width.toFixed(1),
    slack: +(bb2.right - sb2.right).toFixed(1),
    escapes: sb2.right > bb2.right + 0.5,
    wraps: [...sw2.querySelectorAll('button')].some((b) => b.getBoundingClientRect().top > sb2.top + 1),
    bodyScrollW: body2.scrollWidth,
    bodyClientW: body2.clientWidth,
    docOverflowsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    summary: fold2.querySelector('summary').textContent.trim(),
    hint: [...fold2.querySelectorAll('.fold-body .note')].map((n) => n.textContent.trim().slice(0, 40)),
  };

  // 切回中文（同样按 EN 定位语言开关，避免撞上字号开关的「中」）
  const langSw2 = [...document.querySelectorAll('.sw')].find((s) =>
    [...s.querySelectorAll('button')].some((b) => b.textContent.trim() === 'EN'),
  );
  [...langSw2.querySelectorAll('button')].find((b) => b.textContent.trim() === '中').click();
  await sleep(800);
  out.backToZh = document.documentElement.lang;

  return out;
})()
