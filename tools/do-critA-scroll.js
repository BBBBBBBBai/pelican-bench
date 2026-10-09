const el = document.querySelector('.model-pick');
if (el) el.scrollIntoView({ block: 'center' });
await new Promise(r => setTimeout(r, 350));
const r = el ? el.getBoundingClientRect() : null;
return { found: !!el, rect: r && { x: r.x, y: r.y, w: r.width, h: r.height } };
