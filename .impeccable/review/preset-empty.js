// --do 文件：从界面上把清单一条条叉掉，看空态、看「恢复出厂清单」能不能把人救回来。
// 关键：必须点界面上的叉，不能直接 PUT —— 直接 PUT 不会刷新 React 里的 config，
// 那样测到的是「盘上的值」，不是用户看到的东西。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cfg = () => fetch('/api/config').then((r) => r.json());
const put = (body) =>
  fetch('/api/config', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const before = (await cfg()).modelPresets;
document.querySelector('.preset-head')?.scrollIntoView({ block: 'center' });
await sleep(300);

const notes = () => [...document.querySelectorAll('.preset-head ~ .note')].map((n) => n.textContent.trim());
const restoreBtn = () => document.querySelector('.preset-head button');
const out = { startLen: before.length, restoreDisabledAtStart: restoreBtn().disabled };

// 一条条叉掉（每点一次都走 saveGlobal → onConfigChanged，界面是真的在跟着变）
for (let i = 0; i < before.length; i++) {
  const rows = [...document.querySelectorAll('.preset-row')];
  rows[0].querySelector('button.preset-drop').click();
  await sleep(320);
}

const disk = (await cfg()).modelPresets;
out.diskLenAfterUIEmpty = disk.length;
out.rowsWhenEmpty = document.querySelectorAll('.preset-row').length;
out.emptyShown = notes().some((n) => n.includes('清单是空的'));
out.notesNow = notes();
out.restoreDisabledWhenEmpty = restoreBtn().disabled;

// 恢复出厂清单
restoreBtn().click();
await sleep(900);
const afterRestore = (await cfg()).modelPresets;
out.restoredLen = afterRestore.length;
out.restoredFirst = afterRestore[0];
out.emptyGoneAfterRestore = !notes().some((n) => n.includes('清单是空的'));
out.restoreDisabledAfterRestore = restoreBtn().disabled;
out.sameAsFactory = JSON.stringify(afterRestore) === JSON.stringify([...out.factoryGuess ?? []]);

// 还原到巡检前
await put({ modelPresets: before });
await sleep(300);
out.finalSame = JSON.stringify((await cfg()).modelPresets) === JSON.stringify(before);
return out;
