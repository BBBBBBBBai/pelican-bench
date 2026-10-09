# 供应商回执：从底部 toast 改为标题行就地回执

## 任务

用户原话（m00438）：

> 编辑或新增供应商后点击保存后的小提示框不够显眼，给它移到"供应商"的右边，让用户更容易看到

**目标是「更容易看到」，「移到右边」只是用户提的手段。** 追问的价值在于发现两者冲突：实测表明「保存」键在桌面距标题行 415px、在手机上标题行必然在屏幕外（见下），所以「搬到标题行右边」在手机上反而会**更看不见**——手机因此分端处理，回执留在屏幕底部。

## 十轮追问定下的十条

| # | 分支 | 决定 | 依据 |
|---|---|---|---|
| 1 | 范围 | 只搬供应商这一节的两个动作（保存 / 删除）；其余 5 处 `showToast` 与「加载中」提示全不动 | 用户否决「整套 toast 都搬」与「两处同时显示」 |
| 2 | 长相 | 丝印字 + `role="status"`，不播入场动画 | `DESIGN.md:185`/`:407`：全世界只有三个编排动作，别处不做入场动画 |
| 3 | 失败面 | 成功与失败都就地 | 校验失败（`ControlPanel.tsx:176`）与接口报错（`:203`）跟成功同位置 |
| 4 | 删除 | 一起搬 | `DESIGN.md:324`「供应商与测试记录共用这一条规则 —— 同一台仪器里同一件事只有一种长相」 |
| 5 | 寿命 | 5s（原 2.6s） | 用户没选「留到下一次动作」 |
| 6 | 落点 | 「新建」键左边 + 固定宽度槽位，刻线长度永不改变 | 回执出现/消失时整行不抽动 |
| 7 | 长文案 | 短词进标题行；长句另起一行 `p.note[role="status"]`，`--fault`、`maxWidth:62ch`、不播动画 | 照抄 `DESIGN.md:324` 给「删除后果说明」立的先例 |
| 8 | 成功色 | `--ok` 绿 `#8faa62`（对 `--panel` 实算 6.79:1） | 见「张力 ①」 |
| 9 | 桌面滚动风险 | 接受，不修 | 实测右栏内容 1413px / 视野 900px，滚过 47px 标题行就出视野 |
| 10 | 手机 | 分端：手机上回执固定在屏幕底部 | 见「张力 ②」 |

## 改动

不是 git 仓库（`git rev-parse` → `fatal: not a git repository`），以下是手写 diff。**只有两个文件被改，没有新增 i18n key，没有碰 `App.tsx` 的 toast 通道。**

### `web/src/components/ControlPanel.tsx`（798 行 / 33630 字节 / LF / 结尾有换行）

`+` 为新增，`~` 为改向。

```diff
-import { useEffect, useMemo, useState } from 'react';
+import { useEffect, useMemo, useRef, useState } from 'react';

+  // 供应商这一节的就地回执。不走 App.tsx 的 onToast —— 那个渲染在根节点，
+  // 够不着标题行。设置区（saveGlobal）仍用 onToast。
+  const [receipt, setReceipt] = useState<{ msg: string; ok: boolean } | null>(null);
+  const receiptTimer = useRef<number | null>(null);
+
+  function showReceipt(msg: string, ok = true) {
+    setReceipt({ msg, ok });
+    if (receiptTimer.current !== null) window.clearTimeout(receiptTimer.current);
+    receiptTimer.current = window.setTimeout(() => setReceipt(null), 5000);
+  }
+
+  function clearReceipt() {
+    if (receiptTimer.current !== null) window.clearTimeout(receiptTimer.current);
+    receiptTimer.current = null;
+    setReceipt(null);
+  }
+
+  // 卸载时把表收掉，别让定时器在已卸载的组件上 setState。
+  useEffect(() => () => {
+    if (receiptTimer.current !== null) window.clearTimeout(receiptTimer.current);
+  }, []);

   function startNew() {
+    clearReceipt();
     ...
   }
   function startEdit() {
     if (!selected) return;
+    clearReceipt();
     ...
   }

   // submit()
-      onToast(t('ctrl.needFields'), true);
+      showReceipt(t('ctrl.needFields'), false);
-      onToast(t('run.saved'));
+      showReceipt(t('run.saved'));
-      onToast(err instanceof Error ? err.message : String(err), true);
+      showReceipt(err instanceof Error ? err.message : String(err), false);

   // remove()
-      onToast(t('run.deleted'));
+      showReceipt(t('run.deleted'));
-      onToast(err instanceof Error ? err.message : String(err), true);
+      showReceipt(err instanceof Error ? err.message : String(err), false);

   // saveGlobal() —— 没动，设置区不属供应商这一节
       .catch((err: unknown) => onToast(err instanceof Error ? err.message : String(err), true));
```

JSX（`:255-275`）：

```diff
   <Head
     label={t('ctrl.profiles')}
     right={
-      <button type="button" className="btn quiet" onClick={startNew} disabled={editing === 'new'}>
-        {t('ctrl.add')}
-      </button>
+      <>
+        {/* 回执槽位。常驻在树里、宽度留死，所以刻线长度不随它变 ——
+            空的时候它只是这段空白，而桌面端这份空白是刻意的。
+            role=status 让它出现时被朗读（跟 `.mp-status` 同一个理由）。 */}
+        <span className="prov-receipt" role="status">
+          {receipt?.ok ? receipt.msg : ''}
+        </span>
+        <button type="button" className="btn quiet" onClick={startNew} disabled={editing === 'new'}>
+          {t('ctrl.add')}
+        </button>
+      </>
     }
   />
+
+  {/* 长句子另起一行，理由写在 styles.css 的 .note.prov-receipt-note 上。 */}
+  <p className="note prov-receipt-note" role="status">
+    {receipt && !receipt.ok ? receipt.msg : ''}
+  </p>
```

另外两处提前清空（挂着一个属于上一个供应商的「已保存」是误导）：

```diff
   // 名册槽位 :289-292
-                  onClick={() => onSelect(p.id)}
+                  onClick={() => {
+                    clearReceipt();
+                    onSelect(p.id);
+                  }}
   // 取消键 :439-443
-                onClick={() => setEditing(null)}
+                onClick={() => {
+                  clearReceipt();
+                  setEditing(null);
+                }}
```

### `web/src/styles.css`（2135 行 / 63506 字节 / LF / 结尾有换行；原 2073 行 / 60874 字节）

插在 `.bay-head .rule`（`:1137-1141`）之后：

```css
/* 供应商这一节的就地回执槽位。宽度按英文最长的 DELETED（实测 51.25px）留死，
   所以中英切换、有无回执，刻线长度都逐像素不变。
   色用 --ok：这是它第一次当文字色 —— DESIGN.md:210 把它指派给通道格那颗 7px
   小灯，但兄弟色 --warn（.tag）与 --fault 都当过文字色，属按既有规则扩展。
   对 --panel 实算 6.79:1，过 4.5:1。 */
.prov-receipt {
  flex: none;
  min-width: 52px;
  font-family: var(--font-silk);
  font-variation-settings: 'wdth' 74;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: var(--track-label);
  font-size: var(--t-label);
  color: var(--ok);
  white-space: nowrap;
}

/* 长句子（校验失败、接口报错）另起一行 —— 照 DESIGN.md:324 给「删除后果说明」
   立的先例：p.note[role=status]、故障橙、不播入场动画。
   用双类才盖得住更后面同 (0,1,0) 的 .note 的 color。 */
.note.prov-receipt-note {
  color: var(--fault);
  max-width: 62ch;
}

.prov-receipt-note:empty {
  display: none;
}
```

`@media (max-width: 900px)` 块内（`:1981-2000`）：

```css
/* 手机上「供应商」标题行在保存键上方 415px，而视野只有 844px ——
   就地回执在这里等于看不见。所以手机上退回屏幕底部，即保留今天的位置。
   与 DESIGN.md:324「同一件事只有一种长相」有张力，但 DESIGN.md:284 本来
   就有按断点改布局的先例。观感与 .toast 一致。 */
.prov-receipt:empty {
  display: none;
}
.prov-receipt,
.note.prov-receipt-note {
  position: fixed;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  z-index: 90;
  min-width: 0;
  max-width: min(70vw, 62ch);
  margin: 0;
  background: var(--panel);
  border: 1px solid var(--engrave-hi);
  box-shadow: 0 6px 20px rgba(0, 0, 0, .6);
  padding: 9px 15px;
}
.note.prov-receipt-note {
  border-color: #5a2f22;
}
```

## 证据

全部实跑，命令见文末。

### 桌面 1440×900 中文（`tools/do-prov-receipt.js`）

`ruleBefore {x:1161.53, w:145.58}`

| 步骤 | 结果 |
|---|---|
| 保存 | `text 已保存` · `role status` · `color rgb(143,170,98)` · `position static` · `inHead true` · `rect{x:1315.11,w:52,top:22.3,bottom:38.8}` · `topmost self` · **`ruleMoved false`** · **`toastInDom false`** |
| 5.1s 后 | `text ""` · `visible false` · `ruleMoved false` |
| 校验失败 | `noteText 接口地址必须填写` · `noteColor rgb(228,100,63)` · `noteRole status` · **`noteBelowHead true`**（note top 58 > head bottom 31）· `ruleMoved false` · 短槽位 `text ""` |
| 取消 | `noteVisible false` · `slot {open:false, inH:0}` |
| 删除 | `armedText 确认删除` · `text 已删除` · `color --ok` · `ruleMoved false` · `toastInDom false` · `roster ["a6"]` |

`headText "供应商已删除新建"` · `finalRoster ["a6"]` · `selected ["a6"]`

### 手机 390×844 中文

`ruleBefore {x:68.53, w:248.58}`

| 步骤 | 结果 |
|---|---|
| 保存 | `position fixed` · **`bottomGap 22.0`** · `topmost self` · `inHead true` · `rect{x:161.84,w:66.33}`（贴合文字）· `ruleMoved false` · `toastInDom false` |
| 5.1s 后 | 隐藏（w=0, h=0） |
| 校验失败 | `position fixed` · `bottomGap 22` · `topmost self` · `noteBelowHead false`（**手机端刻意如此**） |
| 删除 | `fixed` · `bottomGap 22` · `topmost self` · `roster ["a6"]` |

`bottomGap` 正好 22 且 `topmost self` ⇒ 没有祖先 transform 把 `fixed` 变成相对祖先定位，也没有被别的层盖住。

### 英文 1440×900（先 `tools/do-lang-en.js`，收尾 `tools/do-lang-zh.js`）

`save SAVED` · `fail a base url is required` · `delete DELETED`，三步全部 `ruleMoved false`
⇒ **52px 槽位正好容下最长的 `DELETED`（实测 51.25px），中英切换刻线不动。**

`headText "PROVIDERSDELETEDNEW"` · `htmlLang` en → zh-CN · `config.json` 的 `uiLang` 回到 `zh`

### 视觉

`.impeccable/review/` 下：`receipt-desktop.png` 155993 · `receipt-en.png` 171226 · `receipt-error.png` 156136 · `receipt-mobile.png` 63158 字节。裁 3× 目视确认：

- 桌面：`供应商 ————————————— 已删除 [新建]` —— 绿丝印落在刻线与新建键之间。
- 长错误：`接口地址必须填写` 在标题行下方、故障橙，**刻线长度与有回执时逐像素一致**（空槽位确实占着那 52px）。
- 英文：`PROVIDERS ————— DELETED [NEW]`。
- 手机：底部居中、黑底细边框药丸 `已删除` —— 正是原来 toast 的位置与观感。

### 对比度

两次审计都是 `contrastOffenders: []`，且审计跑的时候回执正亮着（探针最后一步是删除）⇒ 那颗绿真的被量过，不是空跑。

### 项目自己的 QA

- `npm run typecheck`（`tsc -p tsconfig.json --noEmit`）→ 干净。
- `npm run smoke`（先 `npm run mock`）→ **exit 0**：`check:svg` 全通过、`smoke.mjs` **12/12**、`smoke2.mjs`（重试 / 思考落盘 / 模型名大小写）全 PASS、`smoke-abort` PASS、`smoke-sanitize` 14/14 PASS。
- **生产构建也验过**：`npm run build` → `dist/web/assets/index-z8Wb_Dk1.css`（29661 字节）+ `index-CDSWzfKO.js`（193422 字节），旧哈希产物被 Vite 清掉。`server/index.ts:272-278` 在 `dist/web` 存在时会把构建产物也服务出来（8787），所以**两个面都得带上这个改动**。对 `http://127.0.0.1:8787/`（生产构建）重跑同一个探针，数字与 5174（Vite dev）**完全一致**：`ruleBefore {x:1161.53,w:145.58}`、`已保存`/`rgb(143,170,98)`/`static`/`inHead`/`rect w:52`/`ruleMoved false`/`toastInDom false`、失败 `接口地址必须填写`/`rgb(228,100,63)`/`noteBelowHead true`、删除 `已删除`/`ruleMoved false`/`roster ["a6"]`。

## 刻意不改

1. **`web/src/App.tsx:215` 的 toast 通道与其余 5 处调用点**（`App.tsx:80` 流报错、`:85` 运行报错、`:107` 配置读取失败、`:131` 删除记录、`ControlPanel.tsx:247` 设置保存失败）—— 用户明确划定范围。
2. **`saveGlobal`** 仍走 `onToast`：设置区不属供应商这一节。
3. **桌面滚动风险**：右栏内容 1413px、视野 900px，滚过 47px 标题行就出视野。用户明确选「就放标题行，接受这个风险」，否决了 sticky 与「保存后滚回顶部」。
4. **长错误行会把名册往下推一截**：`DESIGN.md:324` 已经接受过这个行为（那条 note 同样推动下方内容），不额外处理。

## 两条要单列的张力

**① `--ok` 是第一次当文字色。** `DESIGN.md:210` 把 `--ok` 指派给通道格那颗 7px 小灯。兄弟色 `--warn`（`.tag`，`styles.css:1002`）与 `--fault`（`styles.css:1006`/`:1366`/`:1894`）都当过文字色，所以这是**按既有规则扩展**而非破例；对 `--panel` 实算 6.79:1，过 4.5:1。代码注释里标明了这一点。

**② 手机端底部固定，与 `DESIGN.md:324`「同一件事只有一种长相」有张力。** 理由是分端处理，而 `DESIGN.md:284` 本来就有按断点改布局的先例（1040px 右栏收窄 300px / 900px 右栏落到机架下方 / 620px 手机）。这是本轮唯一一处主动接受的规则张力。

## 已知局限

1. 52px 槽位是按 **EN 的 `DELETED`（51.25px）** 定的。若将来把回执文案换成更长的词，刻线会开始移动 —— 定宽槽位的代价。
2. 桌面端空槽位占 52px，是刻线不抖的**前提**（用户已选）。若改回 `min-width:0`，回执出现/消失时刻线会伸缩。
3. `role="status"` 用的是隐式 `aria-live="polite"`：回执出现时会被朗读，但 `prov-receipt` 与 `prov-receipt-note` 两个 live region 都在树里常驻（内容为空），屏幕阅读器行为未在真实辅助技术里验证过，只核对了 DOM 属性。
4. 无头环境里程序化 `.focus()` 打不开 `:focus-visible`（CDP harness 的限制），所以本轮的键盘证据来自 `tools/audit-interact.mjs` 的**真实输入**路径，而不是合成事件。

## 顺手修掉的漂移（上一轮 polish 的遗留）

`DESIGN.md:327` 还写着 `- **Disabled:** 字转 `#4d4b45`、无阴影、`cursor: not-allowed`。` —— 那是上一轮 polish 之前的旧值。上一轮把 `web/src/styles.css` 的 `.btn:disabled` 改成了 `color: var(--silk-mute)` + 底退到 `--panel` + 刻线退到 `--engrave`，却漏了这份契约文档。**代码与契约互相矛盾比任何一边单独写错都更危险**：下一个读文档的人会照着 `#4d4b45` 把对比度改回去。

已把该行改成与实现一致，并补上同一条规矩的另一半（禁用态吃掉 `.arm` / `.halt` 的颜色）：

```diff
- - **Disabled:** 字转 `#4d4b45`、无阴影、`cursor: not-allowed`。
+ - **Disabled:** 字转 `--silk-mute`（对 `--panel` 5.2:1 —— 丝印三档全部 ≥4.5:1 是规矩，disabled 不是逃出这条规矩的许可证），底退到 `--panel`、刻线退到 `--engrave`、无阴影、`cursor: not-allowed`。**状态由「平不平」承担，不再由「看不清」承担。** 禁用态同时吃掉 `.arm` / `.halt` 的颜色（`.btn.arm:not(:disabled)` / `.btn.halt:not(:disabled)`）—— 一盏亮在断路上的灯不成立，一颗按不动却红着的键也不成立。
```

`DESIGN.md` 其余引用的行号在本轮之前已核对过：`:210`（Pass Green 那颗 7px 小灯）、`:284`（1040/900/620 断点）、`:324`（`.halt.armed` 的 `p.note[role="status"]` 先例）均未变。

## 数据安全

探针点「保存」会真的 PATCH `config.json`（`ControlPanel.tsx:165` `api.updateProvider`），所以：

- 跑前把 `config.json` 备份到 `$env:TEMP\receipt-config-backup.json`、记录清单到 `$env:TEMP\receipt-records-before.txt`（82 行）。
- 收尾核对：`config.json` sha256 前后都是 `7AF2ED38687A8A98E4201D95014A63AFEAEC5169ADDCA6EF73102E3838ADAFF2`，与备份逐字节一致；供应商仍只有 `p_78j76c5s`（名 `a6`）；`data/records` 回到 82 个文件 / 28 个 `.json` / 两个日期目录。**探针的「新建→删除」来回没有在 config.json 上留下一个字节。**
- **`npm run smoke` 会污染配置**：它真写 44 个记录文件（已按基线清单删净），并且 `smoke2.mjs` 的「关闭保存」用例把 `saveReasoning` 从 `true` 留成了 `false`（它只恢复了 `retries`/`timeoutSec`）。已用 `PUT /api/config {"saveReasoning":true}` 复原，文件与内存双双回到基线。**下次跑 smoke 记得查 `saveReasoning`。**

## 复现

```powershell
# 前置：dev server 在 5174，API 在 8787，假供应商在 9911
npm run mock

# 桌面 / 手机 / 英文三档验收（走真 API，自带还原）
node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --width=1440 --height=900 --do=tools/do-prov-receipt.js
node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --width=390  --height=844 --mobile --do=tools/do-prov-receipt.js
node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --width=1440 --height=900 --do=tools/do-lang-en.js
node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --width=1440 --height=900 --do=tools/do-prov-receipt.js
node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --width=1440 --height=900 --do=tools/do-lang-zh.js   # 必须收尾

# 几何（为什么手机上不能就地）
node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --width=1440 --height=900 --do=tools/do-head-visibility.js
node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --width=390  --height=844 --mobile --do=tools/do-head-visibility.js

npm run typecheck
npm run smoke      # 跑完检查 config.json 的 saveReasoning
```

截图：

```powershell
node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/receipt-desktop.png --width=1440 --height=900 --do=tools/do-prov-receipt.js
node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/receipt-mobile.png  --mobile --width=390 --height=844 --do=tools/do-prov-receipt.js
```

## 留档的探针

- `tools/do-prov-receipt.js`（6656 字节）—— 中英双档验收，走真 API 建/删一次性供应商 `zz-receipt-probe`。
- `tools/do-head-visibility.js`（3169 字节）—— 标题行与保存键的几何，桌面与手机各跑一次。
- `tools/do-lang-en.js` / `tools/do-lang-zh.js` —— 切语言的成对探针（切语言会 PATCH `config.json`，必须成对）。

一次性产物（量宽脚本、裁图脚本、错误态截图脚本、放大图）已全部删除。

## 没动的东西

`tools/` 下另有 8 个 `_css-*.mjs` / `_recovered-styles.css` / `_corrupted-styles-1byte.bin`（10-07 20:0x，styles.css 恢复作业的遗留物），比本轮早、来源不在本次上下文里，**没有动**。
