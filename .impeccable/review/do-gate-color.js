const arm = [...document.querySelectorAll('button')].find(b => b.className.includes('arm'));
const el = document.getElementById('o-model');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
const grab = (tag) => {
  const st = getComputedStyle(arm);
  const r = arm.getBoundingClientRect();
  return { tag, disabled: arm.disabled, color: st.color, borderColor: st.borderColor,
    bg: st.backgroundColor, opacity: st.opacity, cursor: st.cursor,
    boxShadow: st.boxShadow === 'none' ? 'none' : st.boxShadow.slice(0, 60),
    rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] };
};
const out = {};
setter.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true }));
out.empty = grab('model 为空');
setter.call(el, 'gpt-6.1'); el.dispatchEvent(new Event('input', { bubbles: true }));
out.filled = grab('model = gpt-6.1');
setter.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true }));
// 禁用按钮在不在 tab 序里？
out.tabIndex = arm.tabIndex;
out.inTabOrder = (() => { const all = [...document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,summary,[tabindex]:not([tabindex="-1"])')]; return all.indexOf(arm); })();
return JSON.stringify(out, null, 1);
