(async () => {
  // 端到端：新流程建供应商（无模型名）→ 现场选模型名 → 开始生成 → 记录落盘。
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const setVal = (el, v) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // 选中 TempRelay 供应商（走名册）
  const slot = [...document.querySelectorAll('.roster .slot')].find((el) =>
    (el.querySelector('.slot-name')?.textContent ?? '').includes('TempRelay'),
  );
  if (!slot) return { error: 'no TempRelay slot', slots: [...document.querySelectorAll('.roster .slot .slot-name')].map((e) => e.textContent) };
  slot.click();
  await sleep(400);

  out.provider = slot.querySelector('.slot-name')?.textContent?.trim() ?? null;
  out.slotSub = slot.querySelector('.slot-sub')?.textContent?.trim() ?? null;
  out.armDisabled = document.querySelector('.btn.arm')?.disabled ?? null;
  out.runFacts = [...document.querySelectorAll('.run-facts dd')].map((d) => d.textContent.trim());

  // 现场选模型名 —— mock provider 认得 mock-good
  const m = document.getElementById('o-model');
  setVal(m, 'mock-good');
  await sleep(350);
  out.armDisabledAfterModel = document.querySelector('.btn.arm')?.disabled ?? null;

  const cells = [...document.querySelectorAll('.mp-cell .mp-name')].map((n) => n.textContent.trim());
  out.candidatesStillFull = cells.length;

  const before = document.querySelectorAll('.ch').length;
  document.querySelector('.btn.arm')?.click();
  await sleep(4000);

  out.cellsBefore = before;
  out.cellsAfter = document.querySelectorAll('.ch').length;
  out.toast = document.querySelector('.toast')?.textContent?.trim() ?? null;
  out.busbarRead = [...document.querySelectorAll('.window .read-lg')].map((e) => e.textContent.trim());

  // 新记录的格子：第一条（按时间排序）
  const first = document.querySelector('.ch');
  out.firstCell = {
    addr: first?.querySelector('.ch-no')?.textContent?.trim() ?? null,
    animal: first?.querySelector('.ch-animal')?.textContent?.trim() ?? null,
    provider: first?.querySelector('.ch-prov')?.textContent?.trim() ?? null,
    model: first?.querySelector('.ch-model')?.textContent?.trim() ?? null,
    dur: first?.querySelector('.ch-dur')?.textContent?.trim() ?? null,
    hasArt: Boolean(first?.querySelector('.ch-plate img')),
  };

  // 打开详情，看 run-facts 里模型名是不是现场选的那个
  first?.click();
  await sleep(1200);
  const sheet = document.querySelector('.sheet');
  if (sheet) {
    const dt = [...sheet.querySelectorAll('.sheet-facts .facts dt')].map((d) => d.textContent.trim());
    const dd = [...sheet.querySelectorAll('.sheet-facts .facts dd')].map((d) => d.textContent.trim());
    const i1 = dt.indexOf('请求的模型名');
    const i2 = dt.indexOf('供应商');
    out.sheetReqModel = i1 >= 0 ? dd[i1] : null;
    out.sheetProvider = i2 >= 0 ? dd[i2] : null;
    out.sheetHeader = sheet.querySelector('.sheet-head')?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  } else {
    out.sheetMissing = true;
  }

  out.overflowX = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
  return out;
})()
