---
target: 测试模型选择模块
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:E:\\学习资料\\dsh\\鹈鹕测试工具\\web\\src\\components\\ControlPanel.tsx"
target_fingerprint: "sha256:0b337a44f0570a7c910a5cd3fbb480e5839390a8c51e407b749b5a19d0f0e2a7"
target_path: "E:\\学习资料\\dsh\\鹈鹕测试工具\\web\\src\\components\\ControlPanel.tsx"
timestamp: 2026-10-07T19-43-55Z
slug: web-src-components-controlpanel-tsx
---
# Critique — 测试模型选择模块（Model Under Test）

Method: dual-agent (A: aa609b67-012c-4a81-93ea-3ba56e1af15b · B: 0a968719-f8ae-430a-ba81-71b88f22e693)

**Target**: `web/src/components/ControlPanel.tsx:402-453`（选择器）· `web/src/components/ControlPanel.tsx:492-501`（门禁）· `web/src/styles.css:605-687`（样式）
**Slug**: `web-src-components-controlpanel-tsx`
**规格依据**: `PRODUCT.md:37`、`PRODUCT.md:70-75`、`DESIGN.md:358-363`（Model Under Test 小节）、`DESIGN.md:225`、`DESIGN.md:297-308`、`DESIGN.md:354`、`DESIGN.md:396`

---

## 1. 设计特异性裁决

### LLM 评估 —— 视觉 9/10 属于这个产品，交互 4/10 属于任何产品

候选表本身是这套设计系统里最结实的构件之一：`web/src/styles.css:621-630` 用 `display:grid; gap:1px; background:var(--engrave)` 把 1px 刻缝当网格线，每行是一块 `--well` 单元格，行内 9px 方灯，模型名走 Azeret Mono 12px，全无圆角、无投影、无嵌套；选中态用 `#0b0b0a` 凹底 + 琥珀名 + 5×5 实心琥珀灯，实测选中前后行盒**完全一致**（28×313），同时守住 `DESIGN.md:354`「不许用加粗或放大来表达选中」与 The One Light Rule。这一层不重新设计就搬不进别的产品。

但交互层是一个通用的「搜索框即值域」自动补全，穿着这台仪器的外衣：查询串和已提交值是同一个字符串，没有清除控件，没有 combobox 契约，方向键无效，**选中一次之后候选表自己塌成一行**。最能说明问题的一句：这个产品唯一要控制住的变量就是模型名（`PRODUCT.md:37`、`DESIGN.md:359`），而模块在用户第一次成功选中它之后，恰好把「换模型名」这件事变贵 —— 那正是产品论点所在的位置。它是一台仪器面板上的通用搜索框，不是一台仪器的量程选择器。

### 确定性扫描 —— 本模块上零信号，不得引用为「干净」

- `impeccable.cmd detect --json web/src/components/ControlPanel.tsx` → stdout 恰为 `[]`，exit 0，0 findings；换成目录 `web/src/components`、换成整树 `web/`，同样 0 findings。
- **这份 0 无效，已做灵敏度标定**：6 个刻意违规的探针文件（含 `rounded-lg bg-gradient-to-r from-red-500 text-shadow`、`border-radius: 12px`、`linear-gradient(...)`、`font-family: Inter`）中，**5 个 TSX/CSS 文件全部返回 0 findings**；一份把 `border-radius`/`gradient`/`text-shadow`/`Inter` 全写上的 CSS 用 `--no-config` 也只报 1 条 `antipattern: "overused-font"`（severity `warning`, line 1），**且 exit 仍为 0**。非 HTML 目标走正则模式，灵敏度极低。
- 排除豁免：`.impeccable/config.json` 与 `.impeccable/config.local.json` **均不存在**；`web/src` 中无任何 `impeccable-disable` 内联豁免；`window.__IMPECCABLE_PROJECT_IGNORES__` = `{"ignoreRules":[],"ignoreValues":[],"ignoreFiles":[],"roots":["web/"],"pageFiles":["web/index.html"]}`（空豁免）。干净不是豁免造成的，是检测器看不见。
- **反向证据（同一 skill 的页内检测器，同一页面）**：`[impeccable] 49 anti-patterns found`。规则只有两条 —— `dark-glow`（零偏移辉光，`span.lamp.fault/.ok/.warn`，色 `#e4643f`/`#8faa62`/`#c8862f`）与 `undersized-ui-text`（10.5px 功能文字，`span.tag.fault/.warn`，文本 `渲染失败`/`已中止`/`输出截断`/`没有 SVG`/`模型名不一致`）。**51 条里 0 条提到模型选择器**（对 `mp-|model|o-model|picker` 过滤为空）。
- 结论：CLI 的 0 与页内的 49 互相矛盾，**两者都不能为这个模块背书**。下面的裁决完全建立在 LLM 评估 + 浏览器实测之上。检测器报告里唯一落在本页面的 `text-occlusion` 已证伪（见「次要观察」）；`dark-glow` 与 `undersized-ui-text` 都不属于本模块。

---

## 2. Nielsen 十项（0–4，十项全部适用，无 n/a）

| # | 启发式 | 分 | 依据 |
|---|---|---|---|
| 1 | 系统状态可见性 | **2** | 已选名双重呈现（输入框值 + 琥珀凹槽行）做对了；但禁用与启用的「开始生成」**逐项同色**（实测两态 `color: rgb(240,160,32)`、`border-color: rgb(90,69,32)`、`background: rgb(33,32,29)`、`opacity: 1` 完全相同，只差 `cursor` 与 Plate Edge 投影），且没有任何提示 10 个候选里有 3 个在折叠线下（`scrollHeight 289 / clientHeight 218`，可见 7 行 + 第 8 行露 16px）。 |
| 2 | 与真实世界匹配 | **3** | 刻缝、凹槽、方灯、等宽机读名全部对；错位在于同一个窗口既当读数窗又当查询框，而空态文案用的是**搜索**词汇，系统规则却是自由文本。 |
| 3 | 用户控制与自由 | **1** | `.model-pick` 内除输入框与 10 个候选行**无任何其他控件**（实测）＝无清除按钮；`Escape` 实测 `focusMoved:false`、值不变，完全无效；选中后列表塌成 1 行，换模型必须手动全选删除最多 30 字符。 |
| 4 | 一致性与标准 | **2** | 世界内一致（选中态合 `DESIGN.md:361`、焦点走全局琥珀 outline）；但对平台标准不一致（`role="listbox"` 却无 combobox 契约，`#o-model` 的 `role`/`aria-expanded`/`aria-controls`/`aria-activedescendant`/`aria-autocomplete`/`aria-haspopup` 实测全缺，整文档 `[aria-activedescendant]` 计数 **0**），也违反 `DESIGN.md:396`「每一个开关都给全 hover / focus-visible / **disabled** 状态」——`.btn:disabled`（`web/src/styles.css:1216-1220`）被同优先级且更靠后的 `.btn.arm`（`web/src/styles.css:1233-1236`）覆盖。 |
| 5 | 错误预防 | **1** | 门禁程序上只做了非空判断；28px 行 + 1px 刻缝让误触静默换掉整个实验唯一受控变量；拼错的名字静默通过（`zzz`、`gpt-7`、`does-not-exist`、`my-custom-model-v9` 实测都让按钮变可用）；粘贴带前后空格的名字时列表那行不亮（`selectedRows: 0`）而请求发的是 trim 后的值 —— **所见与所发不一致**（`web/src/components/ControlPanel.tsx:184` 发 `model.trim()` vs `web/src/components/ControlPanel.tsx:438` 用未 trim 的原值比较）。 |
| 6 | 识别而非回忆 | **2** | 候选表与宽容的子序列匹配免去记忆；但选完菜单消失，第二次必须凭记忆重输。 |
| 7 | 灵活与高效 | **2** | 真有加速器：`web/src/components/ControlPanel.tsx:419` 的 `q = model.trim().toLowerCase().replace(/\s+/g,'')` 对 `s.toLowerCase()` 子序列匹配，实测 `dsr`/`DSR`/`d s r` 三种写法都精确隔离出 `deepseek-v3.2-reasoner-preview`；但输入框上 ArrowDown/ArrowUp/Enter/Home/End 实测**全部无效果**，无清除键，满列表时从输入框起按 **11 次 Tab** 才离开候选表。 |
| 8 | 美学与极简 | **3** | 无装饰、无嵌套、选中不改尺寸；被两处拖住：空态那 34px 灰带是整张表里**唯一不画 `--well` 底**的表面（露出 `--engrave`，把文字压到 4.15:1），以及模块自身高度 255px→65px 的塌陷。 |
| 9 | 识别/诊断/恢复错误 | **1** | 唯一解释是 `title`；它确实成了 AX description（实测 `description:"先选定模型名才能开始生成"`），但挂在**不可聚焦、不在 tab 序**的禁用按钮上 —— 实测从输入框起 24 次 Tab 从未落到它身上（`tabPressesToStartButton: null`）。 |
| 10 | 帮助与文档 | **3** | 「先定一个模型名，再按「开始生成」。同一家供应商可以反复换模型名测。」位置、长度、语气都对，14px、实测 5.23:1；扣分因为无 `aria-describedby`（note 无 id），且它承诺的工作流正是模块最不支持的。 |

**总分 20/40 = 50%，落在 "Acceptable"（20–27）最下沿 —— 需要大改，不是打磨。**

---

## 3. 认知负荷（8 项，失败 3/8 = 中度，address soon）

- **Single focus — PASS**：模块独占「本次运行」段，无竞争元素。
- **Chunking — FAIL**：10 个候选在一张无分组平表里，每行等权。
- **Grouping — PASS**：1px 刻缝 + 单一 `--engrave` 边框，整块一张凹槽表。
- **Visual hierarchy — PASS**：11px 丝印标签 → 输入框 → 表格 → 提示句，层级清楚。
- **One thing at a time — PASS**：门禁强制了「先定名再运行」的顺序。
- **Minimal choices — FAIL**：唯一决策点 **10 个可见选项**（7 行完整 + 第 8 行露出约 16px + 3 行完全在折叠线下）。
- **Working memory — PASS**：不需要跨屏记忆，选中的名字留在输入框。
- **Progressive disclosure — FAIL**：220px 表**始终全展开**，而选中后复杂度不是按需揭示而是**反向消失**。

超 4 选项的决策点：候选模型表（10 项）。

---

## 4. 情感旅程

峰值是点中一行的瞬间：那行凹进 `#0b0b0a`、名字转琥珀、9px 方灯里填上 5px 琥珀方块并亮起 4px 光晕 —— 读起来完全像在真面板上扳下一个挡位。这是全模块最好的 200ms，也是本次评审里唯一不想改的东西。

低谷是那道门禁：禁用的「开始生成」与启用的一样是满饱和琥珀（实测逐项同色），用户看到全屏最亮、最像「通电」的东西，按下去什么都不会发生，而唯一的原因句藏在 `title` 里、挂在一个键盘 24 次 Tab 都到不了的禁用按钮上 —— 对这个世界的规则来说，这是一盏**亮在断路上的灯**。紧接着是第二个低谷：选中一行的同一帧里候选表从 220px 塌到 30px，下方所有内容**上跳 161–190px**（选 `deepseek-v3.2-reasoner-preview` 时 `.btn.arm` 725→535，即 190px；选 `gpt-6.1` 时 725→564，即 161px），手在鼠标上时主操作按钮在指针底下跑掉了。

按峰终定律，交互结束时留在屏幕上的是**朴素文本框 + 一行琥珀** —— 终态比初始态信息更少，用户记住的是「选完之后那个选择器不见了」。选择时的安心感本身很高（三重冗余 + `aria-selected` 与视觉完全对应，不动尺寸/字重），唯一缺的是「这个选择已经**生效**」的确认：它只是输入框里的文本，敲一个字符就被替换。

---

## 5. 做得好的地方

1. **选中态三重编码且尺寸恒定**：`background:#0b0b0a` + `color:var(--lamp)` + `.mp-dot::after` 5×5 琥珀实心块 + `aria-selected="true"`，实测选中前后行盒 28×313 **完全一致**。同时满足 `DESIGN.md:354` 与 The One Light Rule，且非视觉用户拿到的语义与视觉用户看到的完全对应 —— 这一条没有妥协。
2. **容错到「人本来就马虎」的子序列匹配**：`web/src/components/ControlPanel.tsx:408-420` 的 `hit()` 配合 trim + 去空格 + 小写，让 `dsr`、`DSR`、`d s r` 三种写法都精确隔离出 `deepseek-v3.2-reasoner-preview`（三种输入实测）。这是 Operate 模式真正的加速器。
3. **候选表用机架自己的词汇搭**：`display:grid; gap:1px; background:var(--engrave)`，1px 缝即刻线，每行是 `--well` 单元格，容器按规格固定在 220px（`web/src/styles.css:621-630`）。不重新设计就搬不进别的产品 —— 这是设计专属性的硬证据。

---

## 6. Priority Issues

### P0 — 禁用态与启用态同色，门禁在视觉上不存在

`web/src/styles.css:1216-1220` 的 `.btn:disabled { color:#4d4b45; cursor:not-allowed; box-shadow:none }` 被 `web/src/styles.css:1233-1236` 的 `.btn.arm { color: var(--lamp); border-color:#5a4520 }` 覆盖 —— 两条选择器同优先级 (0,2,0)，后者源码位置更靠后故胜出。

实测（model 为空 vs model 填 `gpt-6.1`）：`color`、`border-color`、`background`、`opacity` **逐项完全相同**，只有 `cursor`（`not-allowed` → `pointer`）与 Plate Edge 投影不同。这不是对比度问题（琥珀 `rgb(240,160,32)` on `rgb(33,32,29)` = 7.6:1，达标），是**状态问题**：世界的第一条规则是「琥珀 = 正在通电」（`DESIGN.md:225`），而这里琥珀亮着却不能通电。同时违反 `DESIGN.md:396`「每一个开关都给全 disabled 状态」。

**修法**：把 `.btn.arm` 收窄为 `.btn.arm:not(:disabled)`，或补一条 `.btn.arm:disabled { color:#4d4b45; border-color:var(--engrave) }`。并把原因从 `title` 搬到字段下方那句 14px / 5.23:1 的提示上 —— 门禁关闭时把提示文案换成 `run.needModel` 并加 `aria-live="polite"`，让禁用按钮不再是不在 tab 序里的唯一解释源。

**建议命令**：`/impeccable polish web/src/styles.css web/src/components/ControlPanel.tsx`

### P1 — 候选表的键盘焦点环被滚动容器裁掉，实测几乎不可见

全局 `web/src/styles.css:163-166` 的 `:focus-visible { outline: 2px solid var(--lamp); outline-offset: 2px }` 在 `.mp-cell` 上外扩 4px，而 cell 边框盒 `x 1110–1423` 与 `.mp-grid` 内容盒**完全重合**，`.mp-grid` 又是 `overflow-x/y: auto`。

像素实证（`Page.captureScreenshot` clip x1105 y386 w324 h232 scale 4，Pillow 统计 `#f0a020`）：
- 无焦点 = **0 个琥珀像素**；
- **第一行 `.mp-cell` 被真实 Tab 聚焦 = 仍然 0 个琥珀像素**（该区域截图与无焦点版 **SHA256 完全相同**，`46173C0031666886` / `A17755138F6916B8`）；
- 第 6 行（`deepseek-v3.2-reasoner-preview`）聚焦 = **10016 个琥珀像素，全部落在 css `y 532.0–533.8`（恰好 2px 高）、`css x 1110.0–1422.8` 的一条水平带上** —— 即**只画出环的上边**，左右两条竖边与下边都不存在。

与 10 个候选**全部 `tabIndex=0`**（无 roving tabindex）叠加，后果是键盘用户必须盲穿 10 个看起来完全一样的行：按一次 Tab 换一行，屏幕上没有任何东西移动。站内已有正确写法 —— `web/src/styles.css:771-772` 与 `web/src/styles.css:944-945` 用 `outline: 1px solid var(--lamp); outline-offset: -1px`（内缩，故不会被裁），唯独 `.mp-cell` 依赖全局外向环。

**修法**：给 `.mp-cell:focus-visible` 一条内缩环 `outline: 1px solid var(--lamp); outline-offset: -2px`（与站内既有写法一致），并给 `.mp-grid` 留出 `padding: 2px` 之类的呼吸位。同时把选项改成 `tabIndex={-1}` + roving tabindex，输入框实现 ArrowDown/ArrowUp/Enter/Escape。

### P1 — 选中一个模型就毁掉选择器本身，且没有回头路

查询串就是值：点中 `deepseek-v3.2-reasoner-preview` 等于把查询设成那 30 个字符，`hits` 立刻塌成 **1 行**（实测 rows 10→1、`.mp-grid` 220→30px、模块 255→65px）。`.model-pick` 内除输入框与候选行**没有任何其他控件**（无清除按钮），`Escape` 实测无效（`focusMoved:false`、值不变），也没有 combobox 契约。

而模块自己的提示句写着「同一家供应商可以反复换模型名测」（`web/src/i18n.ts:120-127` 的 `ctrl.modelHint`）—— 换名字正是这个工具的主循环（`DESIGN.md:359`）。模块在自己的核心用例上把成本从「点一下」变成「全选删除最多 30 个字符再重打」。

**修法**：把 `query` 与已提交的 `model` 拆成两个 state；候选表始终渲染全部命中项并标出已提交行，只在输入框有焦点且正在打字时过滤；加 `×` 清除控件；`Escape` 还原为已提交值；空输入上 `Backspace` 取消选择。

### P2 — 无命中空态与门禁互相打脸，且是全模块唯一未过 AA 的文本

输入 `zzz` / `gpt-7` / `does-not-exist` 时 listbox 印「没有匹配的模型名」，而「开始生成」**变成可用**（实测 `disabled:false`、`title:null`、`aria-invalid:null`）。界面用空态告诉用户「这个名字不存在」，门禁却同时说「可以开始」。

对比度：`.mp-empty`（`web/src/styles.css:681-687`）不画自己的背景，于是 `--engrave` 刻缝色 `rgb(45,44,40)` 成为 313×34 的底色，`--silk-mute` `rgb(143,140,130)` 落在上面 = **4.15:1**，低于 `web/src/styles.css:62-66` 自己规定的 4.5:1，是本模块唯一未过 AA 的文本（独立复算两次：本项目 `contrast.py` 4.15:1；内建 AUDIT 4.2）。它还用 `--font-read`（Azeret Mono）12px，而 `DESIGN.md` 的 Note 规格把空态提示明确归给 Archivo 14px `--silk-mute`「它不是路径，所以不用等宽」。结构上它是 `role="listbox"` 的**非 option 直接子元素**（AX 树实测 `{role:"generic"}`、`modelOptions 0`），是一处 ARIA 结构性违规。

**修法**：`.mp-empty` 画 `--well` 底、文字改 `--silk-dim`（7.65:1）；文案改成不再与门禁矛盾，例如「没有候选匹配 —— 仍会用你输入的名字」；把它移出 listbox 或给 `role="presentation"`。

### P2 — 选择器把主操作按钮推动 161–190px

`.mp-grid` 高度随输入实时变化（实测 220 / 88 / 36 / 30px），把下方包括主行动按钮在内的所有内容推来推去：「开始生成」的 y 在 **725 ↔ 593 ↔ 535 ↔ 541** 之间跳（`runBtnTravelPx: 190`，占 900px 视口的 21%），提示句同步 622→432。用户瞄准「开始生成」的过程中，它会在指针底下跑掉。

`DESIGN.md:361` 的原话是「一张**固定在** `max-height: 220px` 的单列凹槽表」—— 规格写的是固定。

**修法**：给 `.mp-grid` 固定 `block-size: 220px`（而不是只有 `max-height`），在固定窗口内滚动；空态与 1 行结果都保持同样的窗口高度。

---

## 7. Persona Red Flags

- **Sam（读屏 + 纯键盘）**：输入框与候选表之间零 ARIA 连接（`#o-model` 无 `role`/`aria-controls`/`aria-expanded`/`aria-activedescendant`，整文档 `[aria-activedescendant]` 计数 0），方向键实测全部无效果 → 选一个模型必须 Tab 逐个盲跳最多 10 行，而且**这 10 行在被聚焦时几乎或完全不显示焦点环**（第一行实测 0 个琥珀像素）。门禁关闭时「开始生成」不在 tab 序里（实测 24 次 Tab 从未到达），唯一的原因句只作为该禁用按钮的 AX description 存在 → **永远拿不到**「先选定模型名才能开始生成」。全页 `[aria-live]` 数量 **0**，过滤后候选数变化与空态那句「没有匹配的模型名」都不会被朗读。`PRODUCT.md:70-75` 把「键盘可完成全流程」写成硬承诺，这一条在本模块上没有兑现。
- **Riley（压力测试）**：任意文本都通过门禁（`zzz`、`gpt-7`、`does-not-exist`、`my-custom-model-v9` 实测均让按钮可用），拼错的模型名以「已选模型」身份进入记录，无任何确认 —— 而这个工具的全部价值就是记录可信度；`server/runner.ts:36` 只做 `if (!model) throw new RunError('还没有选择模型名')`，没有白名单，靠 `server/runner.ts:94 modelMatches` + `server/runner.ts:253-255` 事后报 `code:'model-mismatch'` 才发现。粘贴带前后空格的名字时列表那行不亮（`selectedRows: 0`）但请求发的是 trim 后的名字。69 字符长名让 `.mp-input` 横向裁切（实测 `scrollWidth 469 > clientWidth 356`，`overflow-x: clip`、`text-overflow: clip`、`scrollLeft: 0`，即只看得到名字开头，既无省略号也无长度提示）。
- **Casey（移动端）**：390×844 下行高仍 **28px**、指示灯仍 **9px**、模块宽 358px（实测），`web/src/styles.css` 的四个断点（700 / 1040 / 900 / 620）**没有一个碰 `.mp-*`** —— 模块完全无响应式处理。行与行只隔 1px 刻缝，误触一行就换掉整个工具唯一受控的变量，而 220px 窗口里还有 3 行在折叠线下。好消息是移动端没有横向溢出（`documentOverflowX: 0`、`clipped: []`）。

---

## 8. Minor Observations

1. **`aria-label` 与可见 label 不一致**：`.mp-grid` 的 `aria-label` 是「模型名」（`ctrl.model`），可见 label 是「要测哪个模型」（`ctrl.modelPick`）；切到英文后更明显 —— listbox 叫 `MODEL`，可见 label 是 `MODEL UNDER TEST`。同一个概念在 i18n 里有三个名字（label / placeholder / aria-label）。
2. **`.mp-name` 的 `text-overflow: ellipsis` 在 1440px 下是未被验证的防御性代码**：最长名 `deepseek-v3.2-reasoner-preview` 实测 234px vs 行宽 313px，无一个被截断；1040px 断点右栏收窄到 300px 后（实测 grid 267px）仍未掉尾巴。
3. **中文输入法注释与实现不符**：`web/src/styles.css:611-612` 注释宣称「中文输入法下不误伤」，但实测合成 `sh` 时候选表已塌成空态并印出「没有匹配的模型名」，查询「深度」命中 0。模型名都是拉丁字母，实际伤害有限，但注释与实现不符。
4. **滚动条几乎看不见**：`scrollbar-width: thin; scrollbar-color: rgb(61,58,52) transparent`（`web/src/styles.css:143-146`），滑块对 `--well` 底 ≈ **1.68:1**（overlay 滚动条不占内容宽，实测 cell 宽 313 = grid 内容盒 313，故底色是 `--well` 而非 `--engrave`）。10 个候选在 220px 里只装下 7 行完整 + 第 8 行露 16px，剩 3 行的唯一提示就是这条几乎看不见的滑道。注意 `tools/edge-cdp.mjs:59` 硬编码了 `--hide-scrollbars`，**任何截图里都看不到滚动条**，不能拿截图说「没有滚动条指示」。
5. **两条检测器结论的处置**：`text-occlusion`（报 `div.note` 被 `button.btn.arm.xl.wide` 100% 遮挡）是**假阳性** —— 重叠的 `<details class="fold">` 是关着的，`::details-content` computed style 为 `content-visibility: hidden; block-size: 0px; overflow: clip`，那棵子树根本不绘制；截图 `.impeccable/review/critique-mine-occl-crop.png` 肉眼确认无可见遮挡。`dark-glow`（30 条，全是 `span.lamp.*`，颜色 `#8faa62`/`#e4643f`/`#c8862f`，**无一为 `#f0a020`**）与 `undersized-ui-text`（17 条，全是 10.5px 的 `span.tag.*` 标记铭牌）都**不属于本模块**，按任务边界不裁决 —— 但 `DESIGN.md:355` 已明确记载「收窄时退到 10.5px 是一条救不了场的假药方，已删除」，那条规则值得另开一次全站评审。
6. **减少动态效果无风险**：`--reduce` 下 picker 内 `transitionDuration` 由 `0s` 变 `1e-06s`，`animationName` 两种模式都是 `none`，`.mp-dot::after` 的琥珀辉光是静态 `box-shadow` 不是动画。模块内没有任何运动。
7. **两处「空白候选行」不是缺陷**：DOM 里第 3、4 行渲染的是 26 与 24 字符的真实模型名（`claude-` 前缀，2025 快照名，等宽 7.8px/字符 → 宽 202.8px / 187.2px，字符码点 `63 6c 61 75 64 65 2d …`）。它们在所有字符串通道里显示为空串，是采集管线对字面量的改写伪影（`consoleCount: 0`，无 React duplicate-key 警告）。**候选是 10 个真实名字，不是 11 个、也没有空串。**

---

## 9. Questions to Consider

1. **便签塌掉之后，是什么在告诉用户「你刚输入的名字仍然有效」？**（`DESIGN.md:362` 把候选表定性为「给手用的快捷键」，那么快捷键消失不该等于值消失。）(a) 空态文案改成「没有候选匹配 —— 仍会用你输入的名字」，让便签消失 ≠ 值消失；(b) 候选表永不塌陷，始终渲染全部命中并把已提交行钉住标注「已选定」；(c) 接受塌陷，但在门禁上方常驻一行「已选定 `<名>`」的状态文本。
2. **一盏按不下去的按钮亮着满饱和琥珀，代表什么？**（这个世界的第一条规则是「琥珀 = 正在通电」。）(a) 让禁用态真的暗下去（`.btn.arm:not(:disabled)`），琥珀只在可执行时出现；(b) 保留琥珀但把禁用态改成刻线描边 + `--silk-mute` 字，靠「未点亮」而非「变灰」表达；(c) 换机制：按钮始终可点，点击时把焦点送到模型字段并朗读 `run.needModel`。
3. **选中一个模型名之后候选表从 10 行变成 1 行 —— 这个模块究竟希望用户换模型名，还是不希望？** (a) 明确希望：拆开查询与值，选中后保留完整表并高亮已选行，加清除控件与 `Escape`；(b) 明确不希望：那就把提示句里「同一家供应商可以反复换模型名测」删掉，别再承诺它做不到的事；(c) 折中：给已选行一个「换一个」入口，展开时才恢复全表。
4. **如果用户只能靠 `title` 才知道为什么不能开始，而 `title` 挂在一个不可聚焦的禁用按钮上 —— 这道门禁是给谁看的？** (a) 把它做成可见文案（字段下方状态行 + `aria-live="polite"`），`title` 只作补充；(b) 把原因挂到**可聚焦**的容器上（字段 `aria-describedby` 指向 `run.needModel`），让键盘用户也读得到；(c) 保留禁用，但在按钮旁放一盏真正的指示灯 —— 未选时灯灭，原因写在灯下。
