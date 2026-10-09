/**
 * 键盘：收起时表单不该在 Tab 序列里，展开时该在。
 * 用真的按键序列，不用 el.focus() —— 后者绕过了 tabindex 与 visibility 的判定。
 */
const q = (s) => document.querySelector(s);
const inForm = () => Boolean(document.activeElement?.closest?.('.prov-form'));
const label = () => {
  const a = document.activeElement;
  if (!a || a === document.body) return 'BODY';
  return `${a.tagName}${a.id ? '#' + a.id : ''}.${String(a.className || '').split(' ')[0]}«${(a.textContent || a.value || a.getAttribute('aria-label') || '').trim().slice(0, 14)}»`;
};
const tab = (n, shift) => {
  for (let i = 0; i < n; i += 1) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: Boolean(shift), bubbles: true }));
  }
};
// 合成 Tab 键不搬焦点，得靠 CDP；这里只读静态可聚焦性，作为补充证据。
const focusables = () =>
  [...document.querySelectorAll('.prov-slot a[href], .prov-slot button, .prov-slot input, .prov-slot select, .prov-slot textarea, .prov-slot summary, .prov-slot [tabindex]')]
    .filter((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0 && r.height > 0 && !el.disabled;
    })
    .map((el) => `${el.tagName}.${String(el.className || '').split(' ')[0]}«${(el.textContent || el.value || '').trim().slice(0, 12)}»`);

const closedTabbable = focusables();
const editBtn = [...document.querySelectorAll('.btn')].find((b) => /编辑|EDIT/i.test(b.textContent));
editBtn.click();
await new Promise((r) => setTimeout(r, 420));
const openTabbable = focusables();
const cancelBtn = [...document.querySelectorAll('.prov-form .btn')].find((b) => /取消|CANCEL/i.test(b.textContent));
cancelBtn.click();
await new Promise((r) => setTimeout(r, 420));
const reclosedTabbable = focusables();

return {
  closedTabbable,
  closedHasFormFields: closedTabbable.some((s) => /INPUT|SELECT/.test(s)),
  openTabbableCount: openTabbable.length,
  openHasFormFields: openTabbable.some((s) => /INPUT|SELECT/.test(s)),
  reclosedTabbable,
  stable: JSON.stringify(closedTabbable) === JSON.stringify(reclosedTabbable),
};
