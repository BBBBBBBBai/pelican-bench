(() => {
  const px = (n) => Math.round(n * 100) / 100;
  const rows = [];
  document.querySelectorAll('.sw').forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const p = el.parentElement;
    const pr = p.getBoundingClientRect();
    const pcs = getComputedStyle(p);
    const btns = [...el.querySelectorAll('button')].map((b) => {
      const br = b.getBoundingClientRect();
      const bcs = getComputedStyle(b);
      const range = document.createRange();
      range.selectNodeContents(b);
      const tr = range.getBoundingClientRect();
      return {
        txt: b.textContent.trim(),
        pressed: b.getAttribute('aria-pressed'),
        w: px(br.width),
        h: px(br.height),
        pad: bcs.padding,
        fs: bcs.fontSize,
        ls: bcs.letterSpacing,
        fv: bcs.fontVariationSettings,
        ff: bcs.fontFamily.split(',')[0],
        textW: px(tr.width),
        gapL: px(tr.left - br.left),
        gapR: px(br.right - tr.right),
      };
    });
    rows.push({
      i,
      cls: el.className,
      w: px(r.width),
      h: px(r.height),
      cssWidth: cs.width,
      minW: cs.minWidth,
      maxW: cs.maxWidth,
      boxSizing: cs.boxSizing,
      parentTag: p.tagName,
      parentCls: p.className,
      parentW: px(pr.width),
      parentDisplay: pcs.display,
      parentAlign: pcs.alignItems,
      parentJustify: pcs.justifyContent,
      overflowRight: px(r.right - pr.right),
      btns,
    });
  });
  const rail = document.querySelector('.rail');
  const bay = document.querySelector('.bay, .panel');
  return JSON.stringify(
    {
      vw: innerWidth,
      railW: rail ? px(rail.getBoundingClientRect().width) : null,
      bayW: bay ? px(bay.getBoundingClientRect().width) + ' ' + bay.className : null,
      count: rows.length,
      rows,
    },
    null,
    1,
  );
})()
