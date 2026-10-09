(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { before: {} };
  const empty = document.querySelector('.empty');
  out.before.emptyPresent = !!empty;
  out.before.text = empty ? (empty.textContent || '').trim() : null;

  const btn = [...document.querySelectorAll('.empty button')].find(
    (b) => (b.textContent || '').trim() === '重试',
  );
  out.before.retryFound = !!btn;
  if (!btn) return out;

  btn.click();
  for (let i = 0; i < 40; i++) {
    await sleep(150);
    if (document.querySelector('.bench')) break;
  }
  await sleep(300);

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
