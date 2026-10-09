(async () => {
  const out = {};
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // React 受控输入：必须走原生 setter 再派发 input，否则 React 看不到值变了
  const setValue = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const key = (el, k, composing) => {
    const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    if (composing) Object.defineProperty(ev, 'isComposing', { value: true });
    el.dispatchEvent(ev);
  };

  // 1) 屏外的 .mp-count 应该彻底消失
  out.mpCount = document.querySelectorAll('.mp-count').length;

  // 2) 现场还有几个 live region，各自说什么
  out.liveRegions = [...document.querySelectorAll('[role="status"],[aria-live]')].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      cls: el.className,
      text: (el.textContent || '').trim().slice(0, 40),
      offscreen: r.width === 0 || r.left < -1000,
    };
  });

  // 3) 门禁那句话现在长什么样
  const status = document.querySelector('.mp-status');
  const sCS = cs(status);
  out.mpStatus = status
    ? {
        text: (status.textContent || '').trim(),
        flex: sCS.flex,
        minWidth: sCS.minWidth,
        overflow: sCS.overflow,
        textOverflow: sCS.textOverflow,
        clientW: status.clientWidth,
        scrollW: status.scrollWidth,
        clipped: status.scrollWidth > status.clientWidth,
      }
    : null;

  const hl = document.querySelector('.field-head > label');
  out.fieldHeadLabel = hl ? { minWidth: cs(hl).minWidth, clientW: hl.clientWidth } : null;

  const arm = document.querySelector('.arm');
  out.arm = arm
    ? {
        text: (arm.textContent || '').trim(),
        disabled: arm.disabled,
        title: arm.getAttribute('title'),
        h: Math.round(arm.getBoundingClientRect().height),
      }
    : null;

  // 4) 回执位能不能收窄 + 省略号
  const rc = document.querySelector('.prov-receipt');
  const rCS = cs(rc);
  out.provReceipt = rCS
    ? {
        flex: rCS.flex,
        minWidth: rCS.minWidth,
        overflow: rCS.overflow,
        textOverflow: rCS.textOverflow,
        whiteSpace: rCS.whiteSpace,
      }
    : null;

  // 5) 每个输入框的 maxLength（-1 表示没设）
  out.inputs = [...document.querySelectorAll('input')].map((el) => ({
    id: el.id || null,
    cls: el.className || null,
    type: el.type,
    maxLength: el.maxLength,
    len: (el.value || '').length,
  }));

  // 6) 页面还是不是不横向溢出
  out.doc = {
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    overflowsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };

  // 7) IME 守卫的判别实验：打字 → 下移光标选中第一项 → 组合中的 Enter 不该提交，
  //    非组合的 Enter 才该提交。两步都做，才能证明守卫真的在拦东西。
  const mi = document.querySelector('#o-model');
  out.ime = { present: !!mi };
  if (mi) {
    mi.focus();
    setValue(mi, 'gpt');
    await sleep(60);
    key(mi, 'ArrowDown', false);
    await sleep(60);
    out.ime.afterTypeAndArrow = { value: mi.value, hits: document.querySelectorAll('#mp-grid .mp-cell').length };

    key(mi, 'Enter', true); // 组合中 —— 应该什么都不做
    await sleep(60);
    out.ime.afterComposingEnter = mi.value;

    key(mi, 'Enter', false); // 真正的确认 —— 应该提交
    await sleep(80);
    out.ime.afterRealEnter = mi.value;

    out.ime.guardWorks =
      out.ime.afterComposingEnter === out.ime.afterTypeAndArrow.value &&
      out.ime.afterRealEnter !== out.ime.afterComposingEnter;
  }

  return out;
})()
