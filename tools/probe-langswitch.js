(() => {
  const px = (n) => Math.round(n * 100) / 100;
  const el = [...document.querySelectorAll('.sw')].find((e) => /题面/.test(e.textContent));
  if (!el) return JSON.stringify({ error: 'no prompt-lang switch found' });
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const p = el.parentElement;
  const pr = p.getBoundingClientRect();
  const chain = [];
  let n = el;
  for (let i = 0; i < 6 && n; i += 1) {
    const b = n.getBoundingClientRect();
    const c = getComputedStyle(n);
    chain.push({
      tag: n.tagName,
      cls: String(n.className).slice(0, 60),
      w: px(b.width),
      display: c.display,
      width: c.width,
      minWidth: c.minWidth,
      maxWidth: c.maxWidth,
      flex: c.flex,
      alignSelf: c.alignSelf,
      boxSizing: c.boxSizing,
      pad: c.padding,
      overflow: c.overflow,
    });
    n = n.parentElement;
  }
  const btns = [...el.querySelectorAll('button')].map((b) => {
    const br = b.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(b);
    const tr = range.getBoundingClientRect();
    return {
      txt: b.textContent.trim(),
      w: px(br.width),
      pad: getComputedStyle(b).padding,
      textW: px(tr.width),
      gapL: px(tr.left - br.left),
      gapR: px(br.right - tr.right),
    };
  });
  return JSON.stringify(
    {
      vw: innerWidth,
      swW: px(r.width),
      swH: px(r.height),
      swLeft: px(r.left),
      parentW: px(pr.width),
      swRightInParent: px(pr.right - r.right),
      buttons: btns,
      chain,
    },
    null,
    1,
  );
})()
