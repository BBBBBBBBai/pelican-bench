(() => {
  const out = {};
  const empty = document.querySelector('.empty');
  out.emptyPresent = !!empty;
  out.emptyText = empty ? (empty.textContent || '').trim() : null;
  const btns = [...document.querySelectorAll('.empty button')];
  out.buttons = btns.map((b) => ({
    text: (b.textContent || '').trim(),
    cls: b.className,
    w: Math.round(b.getBoundingClientRect().width),
    h: Math.round(b.getBoundingClientRect().height),
  }));
  out.hasRetry = btns.some((b) => (b.textContent || '').trim() === '重试');
  const err = document.querySelector('.empty .read');
  out.errorLine = err ? (err.textContent || '').trim() : null;
  out.benchPresent = !!document.querySelector('.bench');
  return out;
})()
