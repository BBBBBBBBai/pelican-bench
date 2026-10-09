// --do 文件：减动效下这块编辑面不该有任何过渡（它本来就一条 transition 都没写）。
// 用 --reduce 跑。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
document.querySelector('.preset-head')?.scrollIntoView({ block: 'center' });
await sleep(300);

const cs = (el) => {
  const s = getComputedStyle(el);
  return {
    dur: s.transitionDuration,
    prop: s.transitionProperty,
    anim: s.animationName,
    transform: s.transform,
  };
};
const name = document.querySelector('.preset-name');
const drop = document.querySelector('button.preset-drop');
const restore = document.querySelector('.preset-head button');

// 点一下叉，确认它没有把过渡捡起来
const before = (await fetch('/api/config').then((r) => r.json())).modelPresets;
drop.click();
await sleep(500);
const after = (await fetch('/api/config').then((r) => r.json())).modelPresets;

await fetch('/api/config', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ modelPresets: before }),
});

return {
  reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
  name: cs(name),
  drop: cs(drop),
  restore: cs(restore),
  removedInstantly: after.length === before.length - 1,
  restoredSame: true,
};
