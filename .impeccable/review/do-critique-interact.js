// Interaction probe: filter, empty state, arbitrary name, keyboard contract.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const input = document.querySelector('#o-model');
const grid = document.querySelector('.mp-grid');
const mp = document.querySelector('.model-pick');
if (mp) mp.scrollIntoView({ block: 'center' });
await wait(300);

const setVal = (v) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, v);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const gridState = () => {
  const cells = [...document.querySelectorAll('.mp-cell')];
  return {
    rows: cells.length,
    names: cells.map((c) => c.querySelector('.mp-name')?.textContent ?? '<empty>'),
    selected: cells.map((c) => c.getAttribute('aria-selected')),
    gridH: grid ? Math.round(grid.getBoundingClientRect().height) : null,
    scrollH: grid ? grid.scrollHeight : null,
    clientH: grid ? grid.clientHeight : null,
    empty: document.querySelector('.mp-empty')?.textContent ?? null,
    emptyH: document.querySelector('.mp-empty') ? Math.round(document.querySelector('.mp-empty').getBoundingClientRect().height) : null,
    childTags: grid ? [...grid.children].map((c) => c.tagName.toLowerCase() + (c.getAttribute('role') ? '[' + c.getAttribute('role') + ']' : '')) : null,
  };
};

const out = { initial: gridState() };

// 1. subsequence filter
setVal('dsr');
await wait(120);
out.after_dsr = { inputValue: input.value, ...gridState() };

// 2. filter that matches nothing
setVal('zzz');
await wait(120);
out.after_zzz = { inputValue: input.value, ...gridState() };

// 3. uppercase (case sensitivity of hit())
setVal('GPT-6.1');
await wait(120);
out.after_uppercase = { inputValue: input.value, ...gridState() };

// 4. arbitrary model name not in the list
setVal('my-custom-model-v9');
await wait(120);
out.after_custom = { inputValue: input.value, ...gridState() };

// 5. clear back to full list
setVal('');
await wait(120);
out.after_clear = { inputValue: input.value, ...gridState() };

// 6. click a candidate row
const cells = [...document.querySelectorAll('.mp-cell')];
const target = cells.find((c) => c.querySelector('.mp-name')?.textContent === 'deepseek-v3.2-reasoner-preview') || cells[0];
target.click();
await wait(150);
out.after_click = {
  inputValue: input.value,
  focusedAfterClick: document.activeElement?.id || document.activeElement?.className || document.activeElement?.tagName,
  ...gridState(),
};

// 7. keyboard: arrow keys / enter with input focused
input.focus();
await wait(60);
const before = document.activeElement?.id;
const seen = [];
for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp', 'Enter', 'Home', 'End']) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  input.dispatchEvent(ev);
  await wait(60);
  seen.push({
    key,
    prevented: ev.defaultPrevented,
    active: document.activeElement?.id || document.activeElement?.tagName,
    inputValue: input.value,
  });
}
out.keyboard = { focusBefore: before, steps: seen, ariaActiveDescendant: document.querySelector('[aria-activedescendant]') ? 'present' : 'absent' };

// 8. tab order from input to the run button
const runBtn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('开始生成'));
out.runButton = runBtn ? { text: runBtn.textContent.trim(), disabled: runBtn.disabled, title: runBtn.getAttribute('title'), className: runBtn.className } : null;

// 9. does the start gate consider "custom" names valid?
setVal('my-custom-model-v9');
await wait(150);
if (runBtn) out.runButtonAfterCustom = { disabled: runBtn.disabled, title: runBtn.getAttribute('title') };

return out;
