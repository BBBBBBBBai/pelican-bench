(() => {
  const px = (v) => Math.round(v * 10) / 10;
  const box = (e) => { const b = e.getBoundingClientRect(); return { top: px(b.top), left: px(b.left), w: px(b.width), h: px(b.height) }; };
  const cs = (e, p) => (e ? getComputedStyle(e)[p] : null);

  const rail = document.querySelector('.rail');
  const kids = rail ? [...rail.children].map((e) => ({
    cls: typeof e.className === 'string' ? e.className.slice(0, 30) : e.tagName,
    ...box(e),
    text: (e.textContent || '').trim().slice(0, 18),
  })) : [];

  const dets = document.querySelector('.detents');
  const detKids = dets ? [...dets.children].map((b) => ({ w: px(b.getBoundingClientRect().width), h: px(b.getBoundingClientRect().height), top: px(b.getBoundingClientRect().top) })) : [];

  const bus = document.querySelector('.busbar');
  const busKids = bus ? [...bus.children].map((e) => ({
    cls: typeof e.className === 'string' ? e.className.slice(0, 26) : e.tagName,
    ...box(e), disp: cs(e, 'display'), order: cs(e, 'order'),
  })) : [];

  const roster = document.querySelector('.roster');
  const slot = document.querySelector('.roster .slot');

  // scroll behaviour: rail sticky?
  const before = rail ? box(rail) : null;
  document.scrollingElement.scrollTop = 400;
  const after = rail ? box(rail) : null;
  const busAfter = bus ? box(bus) : null;
  document.scrollingElement.scrollTop = 0;

  return {
    vw: innerWidth, vh: innerHeight,
    rail: rail ? { ...box(rail), wrap: cs(rail, 'flexWrap'), pos: cs(rail, 'position'), stickyTop: cs(rail, 'top') } : null,
    railGap: cs(rail, 'gap'), railPad: cs(rail, 'padding'),
    railKids: kids,
    detents: dets ? { ...box(dets), rows: new Set(detKids.map((d) => d.top)).size } : null,
    detKids,
    busbar: bus ? { ...box(bus), gap: cs(bus, 'gap'), pad: cs(bus, 'padding') } : null,
    busKids,
    roster: roster ? { ...box(roster), rows: roster.children.length } : null,
    slot: slot ? box(slot) : null,
    swBox: (() => { const s = document.querySelector('.rail .sw'); return s ? { ...box(s), btn: box(s.querySelector('button')), btnFont: cs(s.querySelector('button'), 'fontSize'), btnPad: cs(s.querySelector('button'), 'padding') } : null; })(),
    selBox: (() => { const s = document.querySelector('.rail select'); return s ? { ...box(s), font: cs(s, 'fontSize'), pad: cs(s, 'padding') } : null; })(),
    silkBox: (() => { const s = document.querySelector('.rail .silk'); return s ? { ...box(s), font: cs(s, 'fontSize') } : null; })(),
    stickyRailScroll400: { rail: after, bus: busAfter, before },
    thumb: (() => { const s = document.querySelector('.roster .slot'); return s ? { ...box(s), font: cs(s, 'fontSize') } : null; })(),
    btnPrimary: (() => { const b = document.querySelector('.btn.arm.xl.wide'); return b ? { ...box(b), font: cs(b, 'fontSize') } : null; })(),
    swBtn: (() => { const b = document.querySelector('.sw > button'); return b ? { ...box(b), pad: cs(b, 'padding'), font: cs(b, 'fontSize') } : null; })(),
    quietBtn: (() => { const b = document.querySelector('.rail .btn.quiet'); return b ? { ...box(b), font: cs(b, 'fontSize'), pad: cs(b, 'padding') } : null; })(),
    swCount: document.querySelectorAll('.rail .sw').length,
  };
})()
