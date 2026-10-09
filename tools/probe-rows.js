(async () => {
  const cells = [...document.querySelectorAll('.ch')];
  const cfg = new Map();
  for (const c of cells) {
    const silk = c.querySelector('.ch-silk');
    const head = c.querySelector('.ch-head');
    const tags = c.querySelector('.tags');
    const key = [
      'cell=' + Math.round(c.getBoundingClientRect().height * 10) / 10,
      'silk=' + Math.round(silk.getBoundingClientRect().height * 10) / 10,
      'head=' + Math.round(head.getBoundingClientRect().height * 10) / 10,
      'tags=' + Math.round(tags.getBoundingClientRect().height * 10) / 10,
    ].join(' ');
    if (!cfg.has(key)) cfg.set(key, []);
    cfg.get(key).push({
      no: c.querySelector('.ch-no')?.textContent,
      dur: c.querySelector('.ch-dur')?.textContent,
      w: Math.round(c.getBoundingClientRect().width),
      headScroll: head.scrollWidth,
      headClient: head.clientWidth,
      headWrap: head.getBoundingClientRect().height,
      tagCount: tags.children.length,
      tagH: [...tags.children].map((t) => Math.round(t.getBoundingClientRect().height)),
      kidH: [...silk.children].map((k) => k.className + ':' + Math.round(k.getBoundingClientRect().height)),
    });
  }
  return [...cfg.entries()].map(([k, v]) => ({ config: k, n: v.length, sample: v.slice(0, 2) }));
})()
