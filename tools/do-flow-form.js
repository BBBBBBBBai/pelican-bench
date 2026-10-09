(async () => {
  // 建供应商表单：没有模型名字段，名字留空时退到主机名。
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const setVal = (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const newBtn = [...document.querySelectorAll('.btn.quiet')].find((b) => b.textContent.trim() === '新建');
  if (!newBtn) return { error: 'no 新建 button' };
  newBtn.click();
  await sleep(500);

  out.formInputIds = [...document.querySelectorAll('.field input, .field select, .field textarea')].map((e) => e.id || e.tagName);
  out.hasModelField = Boolean(document.querySelector('#f-model'));
  out.hasUrlField = Boolean(document.querySelector('#f-url'));
  out.formLabelTexts = [...document.querySelectorAll('.field > label')].map((l) => l.textContent.trim());
  out.namePlaceholderEmptyUrl = document.querySelector('#f-name')?.getAttribute('placeholder') ?? null;

  // 只填接口地址，名字留空 → 占位退到主机名
  setVal(document.querySelector('#f-url'), 'https://api.example-relay.test');
  await sleep(250);
  out.namePlaceholderAfterUrl = document.querySelector('#f-name')?.getAttribute('placeholder') ?? null;

  // 不填 baseUrl 直接保存 → 应被拦住
  setVal(document.querySelector('#f-url'), '');
  await sleep(200);
  const save = [...document.querySelectorAll('.btn')].find((b) => b.textContent.trim() === '保存');
  out.saveDisabledNoUrl = save?.disabled ?? null;
  save?.click();
  await sleep(600);
  out.toastNoUrl = document.querySelector('.toast')?.textContent?.trim() ?? null;

  // 只填地址、名字留空 → 存进去应该用主机名
  setVal(document.querySelector('#f-url'), 'https://api.example-relay.test');
  setVal(document.querySelector('#f-key'), 'sk-probe');
  await sleep(250);
  save?.click();
  await sleep(1200);
  out.slotNamesAfter = [...document.querySelectorAll('.roster .slot .slot-name')].map((e) => e.textContent.trim());
  out.toastAfterSave = document.querySelector('.toast')?.textContent?.trim() ?? null;

  out.overflowX = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
  return out;
})()
