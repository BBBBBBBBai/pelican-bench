(async () => {
  const out = { overflow: [], notes: [] };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s, r = document) => r.querySelector(s);

  const EXTREME = {
    long: 'X'.repeat(120),
    cjk: '超级无敌长名字测试供应商有限责任公司北京分公司上海办事处广州联络点深圳代表处',
    emoji: '🦤🦫🐧🦥🐘🦒🐙🐌🐪🦉',
    rtl: 'مزود خدمة الاختبار الطويل جدا',
    accents: 'Ärgerlicher Ölprüfstand Übertragungsgesellschaft für Größenmessung',
    num: '999999999999',
  };

  const rectOf = (el) => {
    const b = el.getBoundingClientRect();
    return { w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
  };
  // 溢出检测：元素内容比它自己的盒子宽（横向溢出），或超出最近的滚动/裁剪祖先
  const overflows = (el) => el.scrollWidth > el.clientWidth + 1;
  const escapesParent = (el) => {
    const p = el.parentElement;
    if (!p) return false;
    const a = el.getBoundingClientRect();
    const b = p.getBoundingClientRect();
    return a.right > b.right + 1 || a.left < b.left - 1;
  };

  // ── 1. 供应商工位名（.slot-name 允许折行，看的是会不会横向逃逸）
  const slot = q('.slot-name');
  if (slot) {
    const orig = slot.textContent;
    for (const [k, v] of Object.entries(EXTREME)) {
      slot.textContent = v;
      await wait(30);
      const r = rectOf(slot);
      const esc = escapesParent(slot);
      const slotBox = slot.closest('.slot');
      const slotR = slotBox ? rectOf(slotBox) : null;
      if (esc || overflows(slot)) {
        out.overflow.push({ where: '.slot-name', kind: k, ...r, slot: slotR, escapes: esc, scrollW: slot.scrollWidth, clientW: slot.clientWidth });
      }
    }
    slot.textContent = orig;
    await wait(30);
  } else out.notes.push('no .slot-name');

  // ── 2. 通道格里的动物名 / 供应商 / 模型名 / 日期
  const tile = q('.ch');
  if (tile) {
    const chS = tile.querySelector('.ch-silk');
    const inner = chS ? [...chS.querySelectorAll('*')] : [];
    out.tileInnerClasses = inner.map((e) => e.className);
    for (const el of inner) {
      const orig = el.textContent;
      for (const [k, v] of Object.entries(EXTREME)) {
        el.textContent = v;
        await wait(20);
        if (escapesParent(el) || overflows(el)) {
          out.overflow.push({ where: '.ch-silk>' + el.className, kind: k, ...rectOf(el), escapes: escapesParent(el), scrollW: el.scrollWidth, clientW: el.clientWidth });
        }
      }
      el.textContent = orig;
      await wait(20);
    }
  } else out.notes.push('no .ch');

  // ── 3. 通道格头部读数（耗时 / 编号）—— 超大数字
  const head = q('.ch-head');
  if (head) {
    const reads = [...head.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim());
    out.headReadouts = reads.map((e) => ({ cls: e.className, text: e.textContent }));
    for (const el of reads) {
      const orig = el.textContent;
      el.textContent = EXTREME.num;
      await wait(20);
      if (escapesParent(el) || overflows(el)) {
        out.overflow.push({ where: '.ch-head>' + el.className, kind: 'num', ...rectOf(el), escapes: escapesParent(el), scrollW: el.scrollWidth, clientW: el.clientWidth });
      }
      el.textContent = orig;
      await wait(20);
    }
  }

  // ── 4. 筛选横杆的供应商挡位（长名字会不会把横杆撑破）
  const det = q('.detents button');
  if (det) {
    const orig = det.textContent;
    det.textContent = EXTREME.long;
    await wait(40);
    const rail = q('.rail');
    out.overflow.push({
      where: '.detents>button',
      kind: 'probe-long',
      btn: rectOf(det),
      rail: rail ? rectOf(rail) : null,
      railScrollW: rail ? rail.scrollWidth : null,
      railClientW: rail ? rail.clientWidth : null,
      railOverflows: rail ? rail.scrollWidth > rail.clientWidth + 1 : null,
      btnEscapes: escapesParent(det),
      docScrollW: document.documentElement.scrollWidth,
      docClientW: document.documentElement.clientWidth,
      docOverflowsX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    });
    det.textContent = orig;
    await wait(40);
  }

  // ── 5. 回执行（.prov-receipt 是 52px 固定槽位）—— 实测它的最坏情况
  const rec = q('.prov-receipt');
  if (rec) {
    const orig = rec.textContent;
    out.receipt = { cls: rec.className, orig, box: rectOf(rec) };
    for (const v of ['DELETED', '已删除', EXTREME.cjk]) {
      rec.textContent = v;
      await wait(30);
      out.receipt[v === EXTREME.cjk ? 'longCjk' : v] = {
        text: rectOf(rec),
        scrollW: rec.scrollWidth,
        clientW: rec.clientWidth,
        overflows: overflows(rec),
        escapes: escapesParent(rec),
      };
    }
    rec.textContent = orig;
  }

  // ── 6. 全局横向溢出基线
  out.doc = {
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    bodyScrollW: document.body.scrollWidth,
  };

  return out;
})()
