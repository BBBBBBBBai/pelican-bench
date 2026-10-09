(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { before: {}, api: [] };

  const empty = document.querySelector('.empty');
  out.before.emptyPresent = !!empty;
  out.before.text = empty ? (empty.textContent || '').trim() : null;
  const btn = [...document.querySelectorAll('.empty button')].find(
    (b) => (b.textContent || '').trim() === '重试',
  );
  out.before.retryFound = !!btn;
  if (!btn) return out;

  // 等后台回来：探针外面正在把 API 重新拉起来
  let up = false;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      const r = await fetch('/api/config');
      if (r.ok) {
        up = true;
        out.api.push(`ok after ${(i + 1) * 0.5}s`);
        break;
      }
    } catch {
      /* 还没起来 */
    }
  }
  out.apiUpBeforeClick = up;
  if (!up) return out;

  btn.click();
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    if (document.querySelector('.bench')) break;
  }
  await sleep(400);

  out.after = {
    benchPresent: !!document.querySelector('.bench'),
    emptyPresent: !!document.querySelector('.empty'),
    channels: document.querySelectorAll('.ch').length,
    slots: document.querySelectorAll('.slot').length,
    armText: (document.querySelector('.arm')?.textContent || '').trim(),
    modelFoot: (document.querySelector('.mp-foot')?.textContent || '').trim(),
  };
  return out;
})()
