(() => {
  const px = (n) => Math.round(n * 100) / 100;
  const wrap = document.querySelector('[data-impeccable-variants="8965a617"]');
  const out = { vw: innerWidth, hasWrapper: !!wrap, scopeSupported: CSS.supports('at-rule', '@scope') , variants: [] };
  if (wrap) {
    [...wrap.children].forEach((v) => {
      if (v.tagName === 'STYLE') return;
      const vid = v.getAttribute('data-impeccable-variant');
      const inner = v.firstElementChild;
      if (!inner) return;
      const r = inner.getBoundingClientRect();
      const bs = [...inner.querySelectorAll('button')].map((b) => {
        const br = b.getBoundingClientRect();
        const cs = getComputedStyle(b);
        return {
          txt: b.textContent.trim(),
          pressed: b.getAttribute('aria-pressed'),
          w: px(br.width),
          h: px(br.height),
          pad: cs.padding,
          color: cs.color,
          bg: cs.backgroundColor,
          shadow: cs.boxShadow,
        };
      });
      out.variants.push({
        vid,
        cls: inner.className,
        display: getComputedStyle(v).display,
        w: px(r.width),
        h: px(r.height),
        left: px(r.left),
        btns: bs,
      });
    });
  }
  return JSON.stringify(out, null, 1);
})()
