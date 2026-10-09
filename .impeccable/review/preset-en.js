// --do 文件：切到英文，把候选清单滚到画面中间，看英文那套丝印在这张表上合不合身。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const en = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'EN');
en?.click();
await sleep(800);

document.querySelector('.preset-head')?.scrollIntoView({ block: 'center' });
await sleep(400);

const r = document.querySelector('.preset-list').getBoundingClientRect();
const restore = document.querySelector('.preset-head button');
return {
  lang: document.documentElement.lang,
  headLabel: document.querySelector('.preset-head .silk')?.textContent.trim(),
  restoreText: restore?.textContent.trim(),
  restoreW: Math.round(restore.getBoundingClientRect().width),
  tailPlaceholder: document.querySelector('.preset-list > .preset-row:last-child .preset-name')?.placeholder,
  noteText: [...document.querySelectorAll('.preset-head ~ .note')].map((n) => n.textContent.trim()),
  list: { y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width) },
  // 英文比中文长，看看有没有哪一行被撑出横向溢出
  overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
};
