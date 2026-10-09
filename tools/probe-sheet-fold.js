// --expr 文件会被原样 Runtime.evaluate，所以必须自带 async 包装。
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const cell = [...document.querySelectorAll('.ch')].find((b) => b.querySelector('.ch-plate img'));
  if (!cell) return { error: 'no cell with image' };
  cell.click();
  await sleep(1600);

  const folds = [...document.querySelectorAll('.sheet .fold')];
  if (!folds.length) return { error: 'no sheet folds' };
  const g = (f) => ({
    label: f.querySelector('summary')?.textContent?.trim().slice(0, 24),
    open: f.open,
    h: Math.round(f.getBoundingClientRect().height * 10) / 10,
    contentCS: getComputedStyle(f, '::details-content').contentVisibility,
  });

  const before = folds.map(g);

  const f0 = folds[0];
  f0.open = true;
  const ramp = [];
  for (let i = 0; i < 8; i += 1) {
    await sleep(35);
    ramp.push(Math.round(f0.getBoundingClientRect().height * 10) / 10);
  }
  await sleep(500);
  const opened = g(f0);

  f0.open = false;
  await sleep(600);
  const reclosed = g(f0);

  return {
    foldCount: folds.length,
    before,
    ramp,
    opened,
    reclosed,
    docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()
