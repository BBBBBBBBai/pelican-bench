(async () => {
  // 换供应商时模型名必须保留 —— 它现在是要控制住的那个变量。
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const setVal = (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const slots = [...document.querySelectorAll('.roster .slot')];
  if (slots.length < 2) return { error: 'need >=2 providers', n: slots.length };

  slots[0].click();
  await sleep(350);
  setVal(document.getElementById('o-model'), 'deepseek-v3.2-reasoner-preview');
  await sleep(300);
  out.beforeSwitch = document.getElementById('o-model').value;
  out.armBefore = document.querySelector('.btn.arm').disabled;

  // 换到另一家
  slots[1].click();
  await sleep(400);
  out.afterSwitch = document.getElementById('o-model').value;
  out.armAfter = document.querySelector('.btn.arm').disabled;
  out.slotNames = slots.map((s) => s.querySelector('.slot-name')?.textContent.trim());

  // 折叠块的参数是否被清掉（那个应该清）
  const fold = document.querySelector('.fold');
  fold.open = true;
  await sleep(400);
  const t = document.getElementById('o-temp');
  if (t) setVal(t, '0.7');
  await sleep(200);
  out.tempBeforeSwitch = t?.value ?? null;
  slots[0].click();
  await sleep(400);
  out.tempAfterSwitch = document.getElementById('o-temp')?.value ?? null;
  out.modelStillThere = document.getElementById('o-model').value;

  out.overflowX = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
  return out;
})()
