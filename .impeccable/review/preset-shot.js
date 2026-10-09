// --do 文件：把全局设置里的候选清单滚到画面中间，供截图用。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
document.querySelector('.preset-head')?.scrollIntoView({ block: 'center' });
await sleep(400);
const r = document.querySelector('.preset-list').getBoundingClientRect();
return { y: Math.round(r.y), h: Math.round(r.height), scrollY: Math.round(scrollY) };
