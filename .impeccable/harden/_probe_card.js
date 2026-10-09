(async () => {
  const out = { notes: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms = 10000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const v = fn();
      if (v) return v;
      await sleep(120);
    }
    return null;
  };

  // 名册里最新的那格（列表按新在前排）
  const tiles = await waitFor(() => {
    const t = [...document.querySelectorAll('.ch')];
    return t.length ? t : null;
  });
  if (!tiles) { out.notes.push('no .ch tiles'); return out; }
  out.tileCount = tiles.length;

  // 每格都印一遍它显示的文字，找 EFFORT
  out.tileText = tiles.slice(0, 3).map((t) => t.textContent.replace(/\s+/g, ' ').trim().slice(0, 90));
  out.effortInTiles = tiles.filter((t) => t.textContent.includes('EFFORT')).length;

  // 打开最新那格，看详情表里的参数行
  tiles[0].click();
  const sheet = await waitFor(() => document.querySelector('.sheet') ?? document.querySelector('[role="dialog"]'));
  if (!sheet) { out.notes.push('sheet did not open'); return out; }
  await sleep(600);

  out.sheetText = sheet.textContent.replace(/\s+/g, ' ').trim().slice(0, 400);
  out.effortInSheet = sheet.textContent.includes('EFFORT=HIGH');
  out.maxInSheet = sheet.textContent.includes('MAX=32000');

  // 关掉
  const close = [...sheet.querySelectorAll('button')].find((b) =>
    /关闭|CLOSE|×|✕/.test(b.textContent.trim()) || b.getAttribute('aria-label') === '关闭',
  );
  close?.click();
  await sleep(300);
  return out;
})()
