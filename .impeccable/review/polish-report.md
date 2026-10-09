# polish 报告 —— 动物骑单车测试台（web 界面）

- 命令：`/impeccable polish`（无 target → 整个 web surface）
- surface brief：`.impeccable/surfaces/web-src-app-tsx.md`，mode **Operate**
- 日期：2026-10-08（本机时钟）
- 结论：**只改了 `web/src/styles.css` 里三条 `:disabled` 规则。** 其余全部保留。

---

## 1. 读了哪份 critique 快照，以及它的状态

`.impeccable/critique/2026-10-07T19-43-55Z__web-src-components-controlpanel-tsx.md`
（target `web/src/components/ControlPanel.tsx`，总分 20/40，P0=1 P1=2）。

**该快照的 Priority Issues 在当前代码里已经全部清掉了**（combobox ARIA 全套、`aria-activedescendant`、
roving `tabIndex={-1}`、`×` 清除键、Escape 还原、`modelQuery` 与 `model` 拆开、常驻的
`.mp-status[role=status]` 门禁原因句、`.mp-empty` 移出 listbox 并改成「没有候选匹配 —— 仍会用你输入的名字」）。

按 `polish.md:35` 的判定：快照记录的 fingerprint 是
`sha256:0b337a44f0570a7c910a5cd3fbb480e5839390a8c51e407b749b5a19d0f0e2a7`，
当前 `web/src/components/ControlPanel.tsx` 是
`sha256:aa0248b85e9d271d4322268061b3cd62a50a47d9c09ea326b5fbd944fa4e3f11`
→ `critique-storage latest` 会 exit 2、backlog 自动关闭。**因此本轮没有、也不应该执行 `close`。**

快照留下的两条全站线索仍然有效，并且本轮**没有**据此动手：

- 页内检测器在同一页报 `[impeccable] 49 anti-patterns found`，规则只有 `dark-glow`
  （`span.lamp.*` 的零偏移光晕）与 `undersized-ui-text`（`span.tag.*` 的 10.5px）。
  这两条都被 DESIGN.md 正面规定：`DESIGN.md:299` 明确「光晕只加在指示灯上」，
  字号六档里 `--t-micro: 10.5px` 是标签档的既定值。**检测器在这里是误报，不改。**
- `window.__IMPECCABLE_PROJECT_IGNORES__` 是空豁免（`roots:["web/"]`、`pageFiles:["web/index.html"]`）。

---

## 2. Source diff

本仓库**不是 git 仓库**（`git rev-parse` → `fatal: not a git repository`），所以 diff 是手写的。
`web/src/styles.css` 从 2055 行变为 2073 行（60874 字节，纯 LF，结尾有换行）；
**全部改动只在 `:disabled` 态，不碰任何 enabled 视觉、不碰布局、不碰文案。**

> 两个旧色值 `#4d4b45` 与 `#4a4842` **现在只出现在注释里**（我在注释里引用了它们作为「原来是什么」）。
> 以后 grep 到它们别以为规则还在用 —— 活值已经是 `var(--silk-mute)`。

### 2.1 `web/src/styles.css:1330` — `.btn:disabled`（本轮主缺陷）

```diff
+/* 按不下去的键：字退到丝印最暗的那一级（--silk-mute，对 --panel 5.2:1），
+   同时把「升起」这件事整个撤掉 —— 底回到 --panel、刻线退回 --engrave、
+   投影归零。状态由「平不平」承担，不再由「看不清」承担。
+   原来这里写的是 #4d4b45：对 --panel-hi 只有 1.9:1。默认首屏（档案里没有
+   模型名）那颗「开始生成」正是这一态 —— 它是这一屏唯一的主操作，却几乎
+   只剩一个空框，字要先凑近看才认得出。
+   三档丝印全部 ≥4.5:1 是这台仪器的规矩，disabled 不是逃出这条规矩的许可证。 */
 .btn:disabled {
-  color: #4d4b45;
+  color: var(--silk-mute);
+  background: var(--panel);
+  border-color: var(--engrave);
   cursor: not-allowed;
   box-shadow: none;
 }
```

**为什么这是缺陷（证据，不是口味）**：桌面 1440 探针的 `contrastOffenders` 全页只有这一条 ——
`{text:"开始生成", cls:"btn arm xl wide", ratio:1.9, need:4.5}`。而 `config.json` 里的供应商 `a6`
没有模型名，所以**默认首屏就是这一态**：这一屏唯一的主操作字几乎不可见。
要在 `--panel-hi #21201d` 上过 4.5:1，字色得约 `#868379`，几乎等于 `--silk-mute` 本身 ——
**「靠压暗字来表意」这条路在这个调色板上根本走不通**，所以把状态改由「平不平」承担：
底 `--panel-hi`→`--panel`、刻线 `--engrave-hi`→`--engrave`、投影本来就归零。
`.btn.quiet` 的 `background:transparent;border-color:var(--engrave)` 写在后面、同为 (0,2,0)，
所以 quiet 键视觉不变，只靠字色 `--silk-dim`→`--silk-mute` 区分。

### 2.2 `web/src/styles.css:1365` — `.btn.halt` → `.btn.halt:not(:disabled)`（活缺陷）

```diff
+   下面 `.btn.halt` 是同一条规矩的另一半：它同样写在 `.btn:disabled` 后面、
+   同样是 (0,2,0)，于是「删除供应商」在 `busy` 时字和刻线仍然是故障橙 ——
+   一颗按不动却红着的键。红的含义在这台仪器里是确定的（真出事了），
+   不能让一个 disabled 状态借走它。 */
-.btn.halt {
+.btn.halt:not(:disabled) {
   color: var(--fault);
   border-color: #5a2f22;
```

`web/src/components/ControlPanel.tsx:283-286` 的 `className={\`btn quiet halt${armed?' armed':''}\`}`
带 `disabled={busy}`：busy 时它和 `.btn:disabled` 同权重、又写在后面，于是**按不动的「删除」仍然红着**。
enabled 行为逐项不变。

### 2.3 `web/src/styles.css:478` — `.sw > button:disabled`

```diff
+/* Switch 的 disabled 态：目前没有任何一处会渲染它（`Switch` 的 props 里没有
+   disabled），但 DESIGN.md 要求每一个开关都给全 disabled 状态，所以这条留着 ——
+   只是把值改对。原来是 #4a4842，对 --well 只有 2.1:1，等于把「不能按」写成
+   「看不见」。退到 --silk-mute 就够：它本来就是丝印里最暗的一级，而
+   「不能按」另有 cursor 承担，不必再靠压暗字。 */
 .sw > button:disabled {
-  color: #4a4842;
+  color: var(--silk-mute);
   cursor: not-allowed;
 }
```

`#4a4842` 是调色板外的值。**选择「改对」而不是「删掉」**：`web/src/components/bits.tsx` 的
`Switch` props 里没有 `disabled`，这条现在是死代码；但 `DESIGN.md:396` 要求每个开关给全 disabled 态，
删了会让未来某个 disabled 开关**完全没有状态渲染**（一个在模型里存在、在样式表里不存在的状态，
比一个暗但可读的渲染更糟）。

---

## 3. 验证证据

### 3.1 对比度（修前 / 修后）

| 探测 | 修前 | 修后 |
|---|---|---|
| 桌面 1440×1800 `contrastOffenders` | 1 条（`开始生成` 1.9:1） | **`[]`** |
| 移动 390×1500 `contrastOffenders` | — | **`[]`** |
| 桌面 1440 `overflowX` / `clipped` | 0 / `[]` | 0 / `[]` |
| 移动 390 `overflowX` / `clipped` | — | 0 / `[]` |

`tools/do-polish-check.js` 量的是**真实层叠结果**（不是读样式表）：

- 真实 `.btn.arm.xl.wide`（disabled）→ `color:#8f8c82`（`--silk-mute`）、`bg:#191917`（`--panel`）、
  `border:#2d2c28`（`--engrave`）、`box-shadow:none`
- 合成的 `.btn.quiet.halt`（disabled）→ 同上，**边框不再是故障红**
- `.btn.quiet.halt`（enabled）→ `color:#e4643f`（`--fault`）、`border:#5a2f22`（**未受影响**）
- `.sw > button`（disabled）→ `--silk-mute`

几何没有回归：桌面 `cellHeights` 8 行等高 349.8、`plateRatios:[1.3]`、`silkHeights:[121]`；
移动 14 行等高 289.6、同样 `[1.3]` / `[121]`；1200×800 下 10 行等高 356。
`smallTargets` 只剩两个 14×14 的 `.check input`，而它真实的点击目标是包住它的
`<label class="check">`（`padding: 5px 0`）整行 —— 不算缺陷。

### 3.2 键盘与焦点（真实 CDP 输入事件，`tools/audit-interact.mjs`）

- 桌面 1440×900：**`{stops:30, focusVisibleCount:30, withOutline:29, withoutAnyIndicator:[]}`**
- 移动 390×844：**同上（30 / 30 / 29 / `[]`）**
- 29 条走全局 `:focus-visible{outline:2px solid var(--lamp);outline-offset:2px}`；
  唯一没 outline 的是 `SELECT:全部题目`，它走 `input:focus-visible…{border-color:var(--lamp);
  outline:none;box-shadow:inset …,0 0 0 1px var(--lamp)}` —— 实测 `borderColor: rgb(240,160,32)`，
  **有可见指示，`withoutAnyIndicator` 为空**。
- 标本页：`role=dialog`、`label="水豚 · TempRelay"`、打开后焦点落在关闭键、`focusInSheet:true`、
  页内 12 个 tab stop 首个是 `复制题目`（`fv:true`）、**`sheetFocusEscape: 0`（焦点没有漏出对话框）**；
  Esc 后 `sheetGone:true`、焦点回到原来的 `BUTTON.ch` 且 `focusVisible:true`。
- 整页 tab 序（`tools/do-keyboard.js`，71 个 tab stop）合乎阅读顺序：`中/EN` → 11 个供应商拨档 →
  题目 → 排序 → 格子大小 → 全部/只看有异常的 → 28 个通道格 → 新建 → 供应商名册 → 编辑/删除 →
  表单 → 保存/取消 → 模型输入框 → 参数抽屉 → 覆盖值。仓库里没有任何正 `tabIndex`，DOM 序即 tab 序。
- 组合框：`{optionStops:0, gridStops:0, inputStops:1}` —— 十个候选与 `#mp-grid` 都不占 tab stop；
  ArrowDown → `aria-activedescendant="mp-opt-0"`；Enter → 值 `gpt-6.1-sol` 且**门禁打开**；
  `×` 清除 → 值回空且**门禁重新关上**。

### 3.3 空态与恢复路径

供应商选「北方中转」+ 题目选「穿山甲」→ 0 格 → `.empty`「没有符合筛选的记录 / 重置筛选」、
计数「显示 0 / 28」；点重置 → 28 格回来、「显示 28 / 28」、两个筛选回到「全部」、
**重置键自己消失**（`dirty` 归 false）。证据：`.impeccable/review/polish-empty.png`。

### 3.4 触摸、reduced-motion、缩放

- 触摸滚动：`.rack-scroll` 位移 165px 而 `pageMoved:0` —— 容器在真实触摸事件下滚动，页面不动。
- `.rail` 在触摸下 `overflows:false`、`docOverflowX:0`（换行而非横向溢出）。
- `prefers-reduced-motion`：12 条过渡被压成 `1e-06s`；弹窗换成 `sheet-seat-calm`（0.14s），
  结束后 `opacity:1 / filter:none / clipPath:none / visible:true` —— **没有任何东西卡在不可见状态**。
- 页面缩放 150% / 200% / 300%：`docOverflowX` 全部为 0。

### 3.5 英文与 i18n

切到 EN 后扫全页，找形如 `a.b` 的漏网 key：`suspiciousKeys:["api.a6api.com"]`（供应商域名，假阳性）。
**没有漏译。** 实况：`ANIMAL BIKE BENCH | DATES 2 | RECORDS 28 | IDLE`、
`PROVIDER | ALL PROMPTS | ORDER | CELL SIZE | SHOWING 28 / 28`、
`EDIT PROVIDER | DELETE | THIS RUN | MODEL UNDER TEST | PICK A MODEL NAME FIRST`。
动物名与供应商名保持中文是对的（那是 `prompts.json` 与用户数据，不是 UI 文案）。
切语言的探针会把 `uiLang` PATCH 进 `config.json`，已核对结束时仍是 `"uiLang": "zh"`（无残留）。

**英文界面目视**（`.impeccable/review/polish-en.png`，1440×3068 `--expand`）：顶栏
`ANIMAL BIKE BENCH / animal-on-bicycle bench · local, single user / DATES 2 / RECORDS 28 / IDLE`、
筛选横杆 `PROVIDER | ALL | … | PROMPT | ALL PROMPTS | ORDER | NEWEST OLDEST | CELL SIZE | SMALL MEDIUM LARGE |
ALL | ISSUES ONLY | SHOWING 28 / 28`、日期带 `R 2026-10-07 / 2 RECORDS`、通道丝印
`水豚 / TempRelay / mock-good / 2026-10-07 02:50 / RENDER FAILED`、失败格 `WILL NOT RENDER` / `NO SVG`、
右栏 `PROVIDERS / EDIT PROVIDER / DELETE / THIS RUN / PROVIDER / BASE URL / PARAMS / MODEL UNDER TEST /
PICK A MODEL NAME FIRST / START RUN / SETTINGS / PROMPT LANG / TIMEOUT (SEC) / RETRIES / KEEP REASONING /
KEEP RAW RESPONSE / ON DISK`。**英文下没有溢出、没有裁切、没有换行破版**，
`START RUN` 在英文下同样是那颗**看得清的刻线槽位**（disabled 修复在两种语言里都成立）。

> 注：`polish-en.png` 先前是用 `tools/do-polish-check.js` 截的，而那个脚本量完英文会把语言**切回中文**
> 再返回 —— 所以那张图其实是中文界面、文件名撒了谎。已改成先跑 `tools/do-lang-en.js`（只切不切回）
> 截图、再跑 `tools/do-lang-zh.js` 复位，现在这张图是真的英文界面。


### 3.6 项目自己的 QA

- `npm run typecheck`（`tsc -p tsconfig.json --noEmit`）→ **干净**
- `npm run smoke`（`check:svg` + `smoke.mjs` + `smoke2.mjs` + `smoke-abort.mjs` + `smoke-sanitize.mjs`）
  → **全绿**：`check:svg` 全部通过；`smoke.mjs` **12/12 通过**；重试 / 思考过程落盘 / 大小写模型名全 PASS；
  中止用例保住部分结果；sanitize 14 项全 PASS（源码层保留 `rx` 与外链、服务出去的那一份全部抹掉）。
  首次跑时是 2/12，原因是**假供应商没启动**（`tools/smoke.mjs:2` 的用法注释：先 `npm run mock`），
  起 `npm run mock` 后复跑即全绿 —— 与本次 CSS 改动无关。
- 设计检测器：`impeccable detect --json web/src/styles.css` → `[]`。
  **但这个 0 不能当作干净的证明**：本轮早前用 6 个故意违规探针试过，CLI 检测器 5 个返回 0 findings，
  它对 CSS/TSX 近乎失明。所以上面的对比度数字来自真实浏览器实算，不来自检测器。

### 3.7 状态复原（本轮验证没有污染用户数据）

端到端 smoke 会真的写记录、真的改配置。跑前备份 `config.json` 并记下 82 个记录文件清单；
跑完删掉新增的 44 个文件、`config.json` 与备份不一致则从备份恢复。结果：
`data/records` 回到 **28 个 `.json` / 30 个 `.txt` / 24 个 `.svg`**（与跑前逐项相同），
`config.json` 已从备份恢复，`data/records` 下仍只有 `2026-10-06`、`2026-10-07` 两个目录。

---

## 4. 刻意不改的（附理由）

1. **`.stream.reasoning{color:#8a7f68}`**（`web/src/styles.css:1094`）—— 这是全站唯一一个调色板外的颜色，
   看上去像「孤立硬编码」，但 **DESIGN.md 明确批准**：`DESIGN.md:27` 记作 `reasoning-voice`，
   `DESIGN.md:203` 写明它是「丝印三级之外唯一允许的第四档，只用在流式旁白上，不承载任何要读的结论」。
   **不改。**
2. **`.rail{position:sticky;top:0;z-index:5}`**（`web/src/styles.css:487-499`）是空操作：`.rail` 是
   `.rack-scroll` 的兄弟节点，而 `.bay`（`web/src/styles.css:307-312`）是 flex column、没有 overflow，
   唯一的滚动容器是 `.rack-scroll`（`web/src/styles.css:314-319`）。无害，留着。
3. **检测器的 49 条 `dark-glow` / `undersized-ui-text`** —— 见 §1，两条都被 DESIGN.md 正面规定。
4. **移动端 `.panel` 排在整面机架之后**（`.bench` 在 ≤900px 变单列）—— 方向契约的
   FIRST VIEWPORT 写明「首屏就是机架正面」，把控制面板提到前面等于重设计。**不动。**
5. **`server/index.ts:223-236` 的 `PATCH /api/records/:id` 合并 flags 时不重算 `ok`**
   （`server/runner.ts:262` 只在新建时算 `const ok = Boolean(extracted) && flags.length === 0`），
   于是存在 `flags:["render-failed"]` 而 `ok:true` 的记录。**UI 不受影响**（`lampOf` 先看 flags 再看 ok，
   `ok` 字段没有任何地方显示），属后端不变量瑕疵，不在 UI 打磨范围。
6. **`web/src/components/SpecimenSheet.tsx` 里的内联样式**（`.prompt-line` 覆盖 4 个属性、动作行 flex、
   `.code` 染 `--fault`、flag 行染 `--silk-dim`）—— 渲染正确，重构无收益、只有风险。
7. 一条历史记录的 flag detail 是英文串（老版本写的）—— 属数据不属代码。

---

## 5. 已知局限（诚实记录）

1. **CLI 检测器对 CSS/TSX 近乎失明**（见 §3.6），`[]` 不能作为质量证明；本报告的对比度结论
   全部来自真实浏览器实算。
2. **程序化 `focus()` 在无头环境里打不开 `:focus-visible`**：`document.activeElement` 会被设上，
   但连 `matches(':focus')` 都是 false（文档没有系统焦点），`focus({focusVisible:true})` 也是空操作。
   所以焦点环的结论来自 `tools/audit-interact.mjs`（真实 `Input.dispatchKeyEvent` + `Emulation` 域），
   不来自页面内合成事件。**教训写在这里，免得下次再花一遍时间。**
3. **字号全部是 px**（`html 16px`，648/648 个元素用 px 字号），所以不跟随浏览器「默认字号」偏好。
   WCAG 1.4.4（缩放文字）由缩放满足并已实测（150/200/300% 均无横向溢出）；
   但把六档字号令牌改成 rem 会动到这个世界的形式语言本身，不属于打磨，**不做**。
4. `.impeccable/review/audit-interact.json` 是该工具固定的输出路径，跑移动端会覆盖桌面端，
   所以另外存了 `audit-interact-desktop.json` 与 `audit-interact-mobile.json` 两份。

---

## 6. 复现命令

```bash
npm run dev                                   # 需要 dev server 在 8787、web 在 5174
npm run mock                                  # 端到端 smoke 需要假供应商在 9911
npm run typecheck
npm run smoke

node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --width=1440 --height=1800
node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --mobile --width=390 --height=1500
node tools/edge-cdp.mjs shot  http://127.0.0.1:5174/ .impeccable/review/polish-desktop.png --width=1440 --height=1800 --expand
node tools/edge-cdp.mjs shot  http://127.0.0.1:5174/ .impeccable/review/polish-mobile.png  --mobile --width=390 --height=1500 --expand
node tools/edge-cdp.mjs shot  http://127.0.0.1:5174/ .impeccable/review/polish-sheet.png   --width=1440 --height=1000 --do=tools/do-open-sheet.js
node tools/edge-cdp.mjs shot  http://127.0.0.1:5174/ .impeccable/review/polish-empty.png   --width=1440 --height=900 --do=tools/do-empty-state.js
node tools/edge-cdp.mjs shot  http://127.0.0.1:5174/ .impeccable/review/polish-en.png      --width=1440 --height=1800 --expand --do=tools/do-lang-en.js
node tools/edge-cdp.mjs shot  http://127.0.0.1:5174/ .impeccable/review/polish-desktop.png --width=1440 --height=1800 --expand --do=tools/do-lang-zh.js   # 切回中文并顺带刷新

node tools/audit-interact.mjs http://127.0.0.1:5174/ --width=1440 --height=900
node tools/audit-interact.mjs http://127.0.0.1:5174/ --mobile --width=390 --height=844
node tools/edge-cdp.mjs probe http://127.0.0.1:5174/ --width=1440 --height=900 --expr=tools/do-keyboard.js
```

本轮新增、可复跑的状态探针（留在 `tools/`，与仓库既有的 `do-*.js` 惯例一致）：

- `tools/do-polish-check.js` —— 量 disabled 三态的真实计算色、扫漏译 key、切 EN 后复位
- `tools/do-empty-state.js` —— 走空态与「重置筛选」的恢复路径
- `tools/do-keyboard.js` —— 全页 tab 序、组合框键盘链、从 CSSOM 读活的 `:focus-visible` 规则
- `tools/do-lang-en.js` / `tools/do-lang-zh.js` —— 只切语言不切回（/ 切回中文）。
  **切语言的探针必须成对使用**，否则 `config.json` 的 `uiLang` 会留在英文上。

`--do` 脚本的约定：**文件体就是 async 函数体，用顶层 `return`，不要再包一层 IIFE** ——
包了外层就返回 `undefined`，`tools/edge-cdp.mjs` 什么都不打印。
