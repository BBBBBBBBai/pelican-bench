// 删除流：确认后应播完退场动画再卸载并刷新列表；取消则面板纹丝不动。
// 用 `--do=` 调用。用 window.confirm 打桩，不真的删任何记录。
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const origConfirm = window.confirm;
const results = {};

try {
  // ---- 场景 A：用户点「取消」----
  window.confirm = () => false;
  document.querySelector('.ch:not(.live)').click();
  await wait(1300);
  const before = document.querySelectorAll('.sheet').length;
  const delBtn = [...document.querySelectorAll('.sheet .btn')].find((b) => b.textContent.includes('删除'));
  delBtn.click();
  await wait(500);
  results.cancel = {
    sheetStillOpen: document.querySelectorAll('.sheet').length === 1,
    before,
    after: document.querySelectorAll('.sheet').length,
    platePresent: !!document.querySelector('.sheet-plate'),
    scrimPresent: !!document.querySelector('.sheet-scrim'),
  };

  // ---- 场景 B：用户点「确定」，但拦截真实请求 ----
  window.confirm = () => true;
  const realFetch = window.fetch;
  let deleteCalled = false;
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url ?? '';
    if (init?.method === 'DELETE' || /\/api\/records\//.test(url)) {
      deleteCalled = true;
      return Promise.resolve(new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }));
    }
    return realFetch(input, init);
  };

  const delBtn2 = [...document.querySelectorAll('.sheet .btn')].find((b) => b.textContent.includes('删除'));
  delBtn2.click();
  const exit = [];
  for (const t of [0, 60, 120, 220, 420, 700]) {
    await wait(t === 0 ? 30 : 80);
    const s = document.querySelector('.sheet');
    exit.push({
      t,
      sheetOpacity: s ? Number(getComputedStyle(s).opacity).toFixed(3) : null,
      gone: !s,
    });
  }
  results.confirm = {
    deleteCalled,
    exit,
    finalGone: !document.querySelector('.sheet'),
    plateGone: !document.querySelector('.sheet-plate'),
    scrimGone: !document.querySelector('.sheet-scrim'),
    rootInertAfter: document.getElementById('root')?.hasAttribute('inert') ?? null,
    htmlOverflowAfter: getComputedStyle(document.documentElement).overflowY,
    bodyChildren: [...document.body.children].map((c) => c.className || c.tagName),
  };
  window.fetch = realFetch;
} finally {
  window.confirm = origConfirm;
}

return results;
