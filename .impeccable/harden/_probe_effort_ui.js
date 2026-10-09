(async () => {
  const out = { notes: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const r = (el) => { const b = el.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), x: +b.x.toFixed(1), y: +b.y.toFixed(1) }; };
  const cs = (el, p) => getComputedStyle(el).getPropertyValue(p);

  const waitFor = async (sel, ms = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const el = document.querySelector(sel);
      if (el) return el;
      await sleep(100);
    }
    return null;
  };

  const fold = await waitFor('details.fold');
  if (!fold) { out.notes.push('no details.fold'); return out; }

  // 打开折叠
  fold.open = true;
  await sleep(400);

  out.summary = fold.querySelector('summary')?.textContent?.trim() ?? null;

  const sw = fold.querySelector('.effort-row .sw');
  out.swPresent = !!sw;
  if (sw) {
    out.swRect = r(sw);
    const body = fold.querySelector('.fold-body');
    out.foldBodyRect = r(body);
    const bb = body.getBoundingClientRect();
    const sb = sw.getBoundingClientRect();
    // 真实溢出：拨档开关的右沿有没有跑出折叠体
    out.swEscapes = sb.right > bb.right + 0.5 || sb.left < bb.left - 0.5;
    out.swOverflowPx = +(sb.right - bb.right).toFixed(1);
    out.bodyScrollVsClient = { scrollW: body.scrollWidth, clientW: body.clientWidth };
    out.docOverflowsX = document.documentElement.scrollWidth > document.documentElement.clientWidth;

    const btns = [...sw.querySelectorAll('button')];
    out.buttons = btns.map((b) => ({
      label: b.textContent.trim(),
      pressed: b.getAttribute('aria-pressed'),
      rect: r(b),
      pad: cs(b, 'padding-left'),
    }));
    out.swWraps = btns.length > 1 ? (btns[btns.length - 1].getBoundingClientRect().top > btns[0].getBoundingClientRect().bottom - 1) : null;
    out.swGroupLabel = sw.getAttribute('aria-label');

    // 点最高档，看标题是否跟着变
    const maxBtn = btns.find((b) => b.textContent.trim().toLowerCase() === 'max');
    if (maxBtn) {
      maxBtn.click();
      await sleep(300);
      out.summaryAfterPickMax = fold.querySelector('summary')?.textContent?.trim() ?? null;
      out.pressedAfterPickMax = [...sw.querySelectorAll('button')].map((b) => `${b.textContent.trim()}:${b.getAttribute('aria-pressed')}`).join(' ');
      // 还原成 high
      const high = [...sw.querySelectorAll('button')].find((b) => b.textContent.trim().toLowerCase() === 'high');
      high?.click();
      await sleep(300);
      out.summaryRestored = fold.querySelector('summary')?.textContent?.trim() ?? null;
    }
  }

  out.effortHint = fold.querySelector('.fold-body .note:last-of-type')?.textContent?.trim()?.slice(0, 40) ?? null;

  // 旧的「启用思考模式」勾选框应当不存在了
  const allChecks = [...document.querySelectorAll('label.check')];
  out.checkLabels = allChecks.map((l) => l.textContent.trim());
  out.thinkingCheckboxGone = !document.body.textContent.includes('启用思考模式') && !document.body.textContent.includes('ENABLE THINKING');

  // 供应商表单：留空 = 跟随全局默认
  const editBtn = [...document.querySelectorAll('button.btn.quiet')].find((b) => b.textContent.trim() === '编辑供应商');
  if (editBtn) {
    editBtn.click();
    await sleep(500);
    const fTemp = document.querySelector('#f-temp');
    const fMax = document.querySelector('#f-max');
    out.form = {
      tempValue: fTemp?.value ?? null,
      tempPlaceholder: fTemp?.getAttribute('placeholder') ?? null,
      tempTitle: fTemp?.getAttribute('title') ?? null,
      maxValue: fMax?.value ?? null,
      maxPlaceholder: fMax?.getAttribute('placeholder') ?? null,
      maxTitle: fMax?.getAttribute('title') ?? null,
    };
    // 关掉表单
    const cancel = [...document.querySelectorAll('button.btn.quiet')].find((b) => b.textContent.trim() === '取消');
    cancel?.click();
    await sleep(300);
  } else {
    out.notes.push('no 编辑供应商 button');
  }

  // 名册副行：应印出合过全局默认之后的参数（MAX=32000 · EFFORT=HIGH）
  const slotSub = document.querySelector('.slot[aria-pressed="true"] .slot-sub')?.textContent?.trim() ?? null;
  out.rosterSub = slotSub;

  return out;
})()
