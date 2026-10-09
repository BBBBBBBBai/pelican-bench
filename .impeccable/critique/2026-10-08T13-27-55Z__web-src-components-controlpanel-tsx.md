---
target: 右侧模型预选框在添加的模型数量较少时有空白
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:E:\\学习资料\\dsh\\鹈鹕测试工具\\web\\src\\components\\ControlPanel.tsx"
target_fingerprint: "sha256:67236d6b003521345cbd87309eee6ac908ba47f265975efe4b4ca3ccb6ef0651"
target_path: "E:\\学习资料\\dsh\\鹈鹕测试工具\\web\\src\\components\\ControlPanel.tsx"
timestamp: 2026-10-08T13-27-55Z
slug: web-src-components-controlpanel-tsx
closed: true
---
# Critique — 模型候选选择器 + 模型候选清单编辑器

Method: dual-agent (A: fbb27605-7f8d-42c3-8ae0-7d5461ec7864 · B: 07fc9b23-f67e-4224-9df1-40ac8905f64d)

**Target**: `web/src/components/ControlPanel.tsx:586-764`（选择器）· `web/src/components/ControlPanel.tsx:884-949`（清单编辑器）· `web/src/styles.css:653-839`（桌面样式）· `web/src/styles.css:2317-2359`（触屏档）
**Slug**: `web-src-components-controlpanel-tsx`
**规格依据**: `DESIGN.md:155`、`DESIGN.md:293`、`DESIGN.md:367`、`DESIGN.md:374`、`DESIGN.md:376`、`PRODUCT.md:37`、`PRODUCT.md:62-68`、`PRODUCT.md:73`

---

## 0. 先裁决那句抱怨：症状为真，归因反了

用户说「添加的模型数量较少时有空白」。**实测确认，而且他这台机器现在就处在这个状态** —— 本机 `config.json` 的 `modelPresets` 只有 3 条（`gpt-6.1-sol` / `gpt-6-astra` / `deepseek-v4.1-flash`），不是出厂的 10 条。凹槽 218px 的内容盒里有 **134px 是纯 `--well` 空白，占 61.5%**。

无头 Edge 154 实测（`tools/edge-cdp.mjs`，1440×1800，细指针）：

| 候选数 | `#mp-grid` clientHeight | scrollHeight | `.mp-cell` 高 | 纯 `--well` 空带 | `.arm`（开始生成）top |
|---|---|---|---|---|---|
| 1 | 218 | 218 | 28 | **190px（87.2%）** | 886.81 |
| 2 | 218 | 218 | 28 | **162px（74.3%）** | 886.81 |
| 3 | 218 | 218 | 28 | **134px（61.5%）** | 886.81 |
| 7 | 218 | 218 | 28 | 22px（10.1%） | 886.81 |
| 10（出厂） | 218 | 280 | 28 | 0（溢出滚动） | 886.81 |

`#mp-grid` 计算样式 `block-size: 220px`、`align-content: start`、背景 `rgb(16,16,16)` = `--well`；220 − 上下各 1px 边框 = clientHeight 218。源码算术逐项对得上：`.mp-cell` = 5px 内边距 + 18px 行高 + 5px 内边距 = **28px**（`web/src/styles.css:755`、`web/src/styles.css:762`、`web/src/styles.css:756`），218 ÷ 28 = **7.79 行** —— 连出厂的 10 条都装不下，所以这个窗口**永远是滚动窗，却从不长得像滚动窗**。

**但「空白」不是「框太高」造成的。** 那个 220px 是上一轮评审的修法，而且它修对了：实测 `.arm` 的 top 在 1/2/3/7/10 条下**恒为 886.81px，一动不动**。上一轮评审（`.impeccable/critique/2026-10-07T19-43-55Z__web-src-components-controlpanel-tsx.md`，20/40）的 P2 正是「选择器把主操作按钮推动 161–190px」，当时的修法建议就是「给 `.mp-grid` 固定 `block-size: 220px`」。**今天这片空白，就是那个修法的代价。**

所以用户没说错，但他说的是「有空白」，不是「框太高」。要处理的是那片空白**是什么**，不是它**多高**。而 `DESIGN.md` 是过期的那一份：`DESIGN.md:155` 写 `maxHeight: "220px"`、`DESIGN.md:374` 写「一张固定在 `max-height: 220px` 的单列凹槽表」，可 `DESIGN.md:293`（响应式那一节）自己说 `#mp-grid` 是「固定 220px」——与实现一致。**改回 `max-height` 是错的**，三条独立理由见 P0。

---

## 1. 设计特异性裁决

**裁定：固定槽位是这台仪器里唯一真正专属于它的东西，而它的缺陷是「没接上表头」。**

属于这个产品的（成立，不要动）：

- 模型名走 Azeret Mono（`web/src/styles.css:759-760`），是 Mono-Is-Not-Costume 的正确执行 —— 模型名是读数/标识符，不是文案。
- 每行 9px 方形指示灯 `.mp-dot`，选中态 `#0b0b0a` 底 + 琥珀名 + 琥珀灯（`web/src/styles.css:790-814`），是「凹进去 = 选中」这条仪器语法的正确用法。
- 固定 220px 的**理由**写在源码里（`web/src/styles.css:740-743`）并且是真的：过滤到剩一行时按钮会走 190px。这不是偷懒，是仪器直觉 —— 而且实测证实了它（`.arm` top 恒 886.81px）。
- 键盘模型是一等公民：焦点永远留在输入框，游标交给 `aria-activedescendant`（`web/src/components/ControlPanel.tsx:691`），`moveActive` 用 rAF 把游标行拖进视野（`web/src/components/ControlPanel.tsx:617-629`），`data-active`/`:focus-visible` 用内缩 outline 正是为了不被 `.mp-grid` 的 overflow 裁掉左右两边（`web/src/styles.css:781-789`）。这段代码是被认真想过的。

不属于这个产品的（可互换）：

- 抛开凹槽材质，这就是一个 **combobox + 子序列模糊过滤 + 定高结果窗**，任何组件库都能给你。它没有表达「同一个模型名跨供应商」这件**本工具唯一存在理由**的事。
- 仪器面板的隐喻对一个固定窗口有明确期待：**仪器的空窗口永远是「读数」，不是「没有」**。要么显示 0，要么亮故障灯。现在 220px 的凹槽有 61.5% 是空的 `--well`，既没有读数也没有灯 —— 于是固定高度读起来不是「克制的设计决定」，而是「没接上表头」。
- 更要命的是：**真正属于这台仪器的那个数字（候选数）已经在 DOM 里**（`web/src/components/ControlPanel.tsx:759-761`），却被故意推到屏外（`web/src/styles.css:831-839`）。这台仪器的表头被自己藏起来了。

---

## 2. Nielsen 十项（模式 **Operate**，10 项全部适用，满分 40）

| # | 启发式 | 分 | 依据 |
|---|---|---|---|
| 1 | 系统状态可见性 | **2** | 门禁句常驻、空态有文案、已选名双重呈现（输入框值 + 琥珀凹槽行）都做对了；但能解释那片空白的候选计数被藏到屏外（`web/src/styles.css:831-839`），220px 的空窗**没有任何读数解释自己**。 |
| 2 | 与真实世界匹配 | **3** | 「要测哪个模型」「先定一个模型名，再按开始生成」是用户自己的词；扣分在「候选」这个便签语汇没说明它是「我编的清单」还是「系统给的清单」。 |
| 3 | 用户控制与自由 | **2** | Escape 还原已提交名（`web/src/components/ControlPanel.tsx:660-667`）、空框退格 = 清除（`:669-675`）、blur 提交（`:703-707`）都是好的；但「恢复出厂清单」一键整表替换（`:892-899`）无武装无撤销，行内 ✕ 立即删除（`:922-924`）。 |
| 4 | 一致性与标准 | **2** | 选择器与清单共用一套凹槽词汇（好）；但同一文件里两处删除长相不同（两段式 `确认删除` vs 秒删 ✕），回执走两条通道（就地 vs 根 toast，`:336`）。 |
| 5 | 错误预防 | **2** | 破坏性列表操作无确认；加重复名静默 no-op（`web/src/components/ControlPanel.tsx:919-920`、`:940`）—— 打完回车**什么都不发生**，连回执都没有。 |
| 6 | 识别而非回忆 | **3** | 列表可见 + 子序列匹配（`dsr` 命中 `deepseek-v3.2-reasoner-preview`）；但 7.79 行装不下 10 条，而能说明「还有几条」的计数是隐形的。 |
| 7 | 灵活与高效 | **3** | 键盘真的快：`aria-activedescendant` + Arrow/Home/End/Escape/Backspace + 子序列匹配；扣分因为**输入框里打完整名字后按回车是死的**（见 P1）。 |
| 8 | 美学与极简 | **2** | 克制、守规则、选中不改尺寸；但主按钮上方 190px 的空腔不是极简，是**未标注的缺席**，而且同一条指令印了两遍（标签行 `.mp-status` + 下方 `.note`）。 |
| 9 | 识别/诊断/恢复错误 | **2** | 保存失败跑到根 toast（`web/src/components/ControlPanel.tsx:336`），违背本工具自己的回执规则（`DESIGN.md:367`）；重名 no-op 静默；凹槽内部没有任何错误态。 |
| 10 | 帮助与文档 | **3** | `ctrl.modelHint` + `aria-describedby="o-model-hint"` + 按钮 `title` + 清单区 hint，全部走 i18n，是真的；扣分因为帮助文字在凹槽**下方**，而「这张清单在全局设置里能改」只在清单区说，不在使用点说。 |

**总分 24/40 = 60%，落在 "Acceptable" 上沿 —— 比上一轮（20/40）高 4 分，但离 "Good"（28–35）还差一次结构性的修法。**

---

## 3. 认知负荷（8 项，失败 4/8 = 中度偏高，address soon）

| 项 | 判断 |
|---|---|
| Single focus — **2/5** | 一个字段里塞了两件事（打名字 / 浏览表），外加三个 live region。 |
| Chunking — **2/5** | 清单区分块没问题；选择器是「一个 220px 块，内容在 0–7 行之间变」，块本身没有结构。 |
| Grouping — **4/5** | `.field` / `.field-head` / `.mp-row` / `.mp-well` 层级干净，hint 用 id 正确挂上 `aria-describedby`。 |
| Visual hierarchy — **2/5** | 「本次运行」里最重的物体是那 220px 的 `--well`，而它是空的；门禁句用 `--warn` 与字段名争同一行的注意力。 |
| One thing at a time — **3/5** | 先选后跑，顺序清楚。 |
| Minimal choices — **2/5** | **超 4 选项命中**：静息态凹槽一次呈现最多 7 行；清单编辑器更糟 —— 10 行 + 1 添加格 = 11 个目标平铺，无分组、无搜索、无重排。 |
| Working memory — **2/5** | 选完之后凹槽恢复全表、只靠一行高亮标记已选；没有任何线索说明这张清单的来源、条数，以及它和「已选」的关系。 |
| Progressive disclosure — **1/5** | 最差项。计数存在但被藏起来；「清单可编辑」「清单在全局设置里」「空清单不挡任何一次运行」全都**不在使用点披露**。 |

超 4 选项的决策点：① 静息态凹槽（≤7 行）；② 模型候选清单编辑器（10 行 + 1 添加格）。

---

## 4. 情感旅程

- **峰值：没有设计，也不该有。** 这个工具的情绪高峰应该是标本对比。所以这个字段的正确目标是**零情绪** —— 一台安静、完整、不引人注意的仪器。它现在生产的是设计系统明令禁止的那一种：**怀疑**。
- **低谷一（用户抱怨的那一下）**：冷启动。他在 全局设置 → 模型候选清单 里加了自己的模型，滚回「本次运行」，看到 3 行 + 134px 的 `--well`，没有计数、没有刻线、没有标注。他的结论不是「设计如此」，而是「我的清单没保存」。**这是本次评审存在的理由。**
- **低谷二**：在清单里打了一个已存在的名字按回车 —— 静默 no-op（`web/src/components/ControlPanel.tsx:940`）。在用户最期待确认的那一瞬间给出沉默，一律被读成失败。
- **低谷三**：没选供应商 + 已经选了模型名。标签行印着「先选定模型名才能开始生成」，而框里明明有名字，按钮还是灰的（`gateBlocked = !selectedId || modelValue === ''`，`web/src/components/ControlPanel.tsx:204`）。**仪器当面对他说了一句假话，并且不给任何出路。**
- **高利害时刻的安抚**：门禁。方向是对的 —— 原因常驻在标签行、按钮 `title` 兜底，`web/src/components/ControlPanel.tsx:577-581` 的注释显示出真实的键盘推理（禁用按钮不可聚焦，所以原因不能只放 `title`）。但原因和按钮相隔约 230px，而且同一句话印了两遍。
- **峰终**：这段微流程的终点是按下「开始生成」；紧挨着它之前的最后一句是 hint note，而 hint note 在重复门禁句。**收尾是一次重复，不是一次确认。**

---

## 5. 做得好的地方

1. **固定高度的决定本身是对的，而且理由写得比大多数设计文档都诚实**（`web/src/styles.css:740-743`：实测过滤到一行按钮会走 190px），`align-content:start` 的补充也是真的（不写的话只剩一行时那一行会被拉满 220px）。上一轮的跳动确实被治好了 —— 实测 `.arm` top 在 1/2/3/7/10 条下恒为 886.81px。**这条要保住。**
2. **键盘模型是一等公民且自洽**：DOM 焦点不离开输入框、游标交给 `aria-activedescendant`、`moveActive` 用 rAF 把游标行拖进视野（`web/src/components/ControlPanel.tsx:617-629`）、Escape 还原已提交名、空框退格 = 清除按钮的键盘等价物（`:669-675`）、内缩 outline 明确写了「外扩会被 overflow 裁掉」（`web/src/styles.css:781-789`）。
3. **空态的通道纪律**：`.mp-empty` 从 listbox **里**搬出来、成为独立的 `role="status"`（`web/src/components/ControlPanel.tsx:723-725`），文案与门禁一致 ——「没有候选匹配 —— 仍会用你输入的名字」（`web/src/i18n.ts:130-133`，注释明确写了「无候选 ≠ 没东西可测」）。这是一个正确的、专属于这个产品的判断。

---

## 6. Priority Issues

### [P0] 定高槽位没有 1–7 行时的内容模型 —— 那片空白是无标注的缺席

- **What**：`.mp-grid` 固定 `block-size: 220px`（`web/src/styles.css:744`），无论几条候选都渲染整个窗口。实测 1 条 → 190px 空（87.2%）、2 条 → 162px、3 条 → 134px（61.5%）。而能解释它的那个数字被推到屏外（`web/src/components/ControlPanel.tsx:759-761` → `web/src/styles.css:831-839`）。另外 218 ÷ 28 = **7.79**：连出厂的 10 条都装不下（10 × 28 = 280px），所以这个窗口永远是滚动窗，却从不长得像滚动窗。
- **Why it matters**：它正对着整个工具的主操作「开始生成」。用户的读法只有一个：**没保存 / 还在加载**。`PRODUCT.md:60` 说这个界面从没被人真正看过 —— 这条抱怨就是第一份真实证据，而它证明的是**标注缺失**，不是高度问题。顺带：`PRODUCT.md:62-68` 要求单张截图自洽，用户截图给同事看「这工具长什么样」时，主按钮上方那 190px 的空洞是唯一会被注意到的元素。
- **Fix（保住「按钮不许动」这条约束，它是真的）**：
  - **不要**改回 `max-height`。三条独立理由：① 按钮会重新开始跑（实测 190px 的位移）；② 它会**直接打死空态** —— `.mp-empty` 是 `position:absolute; inset:0` 盖在 `.mp-well` 上（`web/src/styles.css:818-827`），而 `.mp-well` 只有 `position: relative`、没有自己的高度（`web/src/styles.css:733-735`），0 命中时表格内容高为 0 → 整句话渲染在 ~2px 的盒子里，恰好在它最需要被读到的时候看不见；③ `.mp-cell + .mp-cell { box-shadow: inset 0 1px 0 var(--engrave) }`（`web/src/styles.css:770-772`）这条刻缝写法存在的唯一理由就是「表格定高之后，最后一行下面那片空白还得是 `--well`」—— 用 `max-height` 之后那片空白根本不存在，这条设计决定就白写了。
  - **推荐做法：槽位恒定 220px，凹槽只占内容高，剩下的空间变成面板材质 + 一行读数。** 按钮位置由 `.mp-well` 的固定高度保证。

    ```css
    .model-pick .mp-well {
      position: relative;
      block-size: 220px;            /* 槽位常数：按钮不动 */
      display: flex;
      flex-direction: column;
    }
    .model-pick .mp-grid {
      flex: 0 0 auto;               /* 不再 flex:1，凹槽随内容走 */
      block-size: auto;
      max-block-size: 198px;        /* 198 − 2 边框 = 196 = 正好 7 行 (7 × 28) */
      align-content: start;
      overflow-y: auto;
    }
    .model-pick .mp-foot {          /* 新增：同一 220px 窗口里的表头读数 */
      margin-block-start: auto;     /* 顶到槽位底部，位置恒定 */
      flex: none;
      block-size: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-inline: 8px;
      border-block-start: 1px solid var(--engrave);
      font-family: var(--font-silk);
      font-size: var(--t-micro);    /* 10.5px */
      letter-spacing: var(--track-label);
      text-transform: uppercase;
      color: var(--silk-mute);
    }
    /* 0 命中时，空态自己就是那个凹槽 —— 所以它要有 --well 底和刻线 */
    .model-pick .mp-empty {
      position: absolute;
      inset: 0 0 20px 0;            /* 只占列表区，不盖表头 */
      background: var(--well);
      border: 1px solid var(--engrave);
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.6);
      padding: 8px;
    }
    ```

    JSX（`web/src/components/ControlPanel.tsx:757` 之后、`.mp-well` 收尾处）：

    ```tsx
    <div className="mp-foot">
      <span role="status">{t('ctrl.modelCandidates', { n: hits.length })}</span>
      <span>{t('ctrl.modelCandidatesTotal', { total: MODELS.length })}</span>
    </div>
    ```

    新增 i18n key：`'ctrl.modelCandidatesTotal'`: zh `共 {total} 条` / en `OF {total}`。
    **效果**：1 条候选时凹槽只有 30px（28 + 2 边框），剩下 190px 是 `--panel`（和区段同材质，读作「面板」，不是「空窗」）；按钮因为 `.mp-well` 是 220px 常数而**一动不动**；表头把「3 / 10」这件事说出来；0 命中时整块仍是完整凹槽 + 空态文案。
  - **更便宜的变体（只加读数、凹槽仍恒定 220px）**：`.mp-grid { block-size: 198px }` + 上面同款 20px 表头，总计 198 + 2 + 20 = 220。用户抱怨的「空白」仍在，但至少**被标注了**，而且 `align-content:start`、行间刻缝、空态全都不用动。若团队要守住「槽位内读数区也恒定」这条更严的规则，选这个变体。
- **建议命令**：`/impeccable clarify`（主）—— 把一个没有含义的空白变成一句读数；配 `/impeccable layout` 处理 220px 窗口内的分配。

### [P1] 输入框里打完整名字后按回车是死的

- **What**：`web/src/components/ControlPanel.tsx:652-658` 只在 `activeName !== null` 时提交，而 `activeName` 来自 `activeIdx`，`activeIdx` 又要求 `modelActive >= 0`（`:603-604`）；`onChange` 每次都把游标重置为 `-1`（`:695-698`）。所以「打字 → 回车」这条最常见的手势**什么都不发生**：`e.preventDefault()` 不会执行，而这个 input **不在 `<form>` 里**（文件里唯一的 `<form>` 在 `web/src/components/ControlPanel.tsx:440-545`，属于供应商那一段），所以「默认行为」就是**没有行为**。用户必须按 ArrowDown 再回车（不可发现），或者 Tab 走开靠 blur 提交。
- **Why it matters**：combobox 里回车是提交手势的第一直觉，而这个工具的整个主循环就是「换模型名反复测」（`PRODUCT.md:37`）。注释写的是「没有游标就不拦（让表单/默认行为照常）」—— 前提不成立，因为这里没有表单。这是本模块唯一一处「按了没反应、而且没有任何东西告诉你为什么」的地方。
- **Fix**：
  ```tsx
  if (e.key === 'Enter') {
    if (activeName !== null) {
      e.preventDefault();
      commit(activeName);
    } else if (hits.length > 0) {
      // 打完整名字后回车 = 提交唯一/第一条命中，而不是什么都不做
      e.preventDefault();
      commit(hits[0]);
    }
    return;
  }
  ```
  **前置条件（必须先做，否则会激活一个潜伏 bug）**：`onKeyDown` 第一行加 `if (e.nativeEvent.isComposing) return;`，并在 `onChange` 里跳过组合期的过滤。`web/src/styles.css:662-663` 的注释已经承认「合成中的拼音（`sh`）会被当成查询串去筛 —— 已知未修」；目前只靠「打字时 `activeIdx` 恒为 -1」侥幸避开拼音候选词提交的那次回车，**一旦按上面改掉回车，这个 bug 会立刻被激活**。
- **建议命令**：`/impeccable harden`。

### [P1] 门禁句在一条分支上说假话，并且同一条指令印了两遍

- **What**：`const gateBlocked = !selectedId || modelValue === ''`（`web/src/components/ControlPanel.tsx:204`）只驱动一句 `t('run.needModel')`「先选定模型名才能开始生成」（渲染在 `web/src/components/ControlPanel.tsx:582-584`，按钮 `title` 同源 `:806-815`）。于是**没选供应商**时，已经选了模型名的用户会看到一句错误的指令。同一条指令又在凹槽下方以 `ctrl.modelHint` 再说一遍（`web/src/components/ControlPanel.tsx:765-767`，`web/src/i18n.ts:124-127`）。
- **Why it matters**：错误文案里最坏的一类是**指错了原因** —— 它把用户推向一个他已经完成的动作。而且这两句在垂直方向相隔约 230px，等于把同一条注意力花了两遍。键盘用户更惨：他在输入框里，原因写在标签行，在他**身后**。
- **Fix**：
  ```tsx
  const needProvider = !selectedId;
  const needModel = modelValue === '';
  const gateBlocked = needProvider || needModel;
  const gateReason = needProvider ? t('run.needProfile') : needModel ? t('run.needModel') : '';
  ```
  `web/src/components/ControlPanel.tsx:582` 渲染 `{gateReason}`；`:806` 的 `title` 用同一个 `gateReason`。新增 `'run.needProfile'`: zh `先选一家供应商` / en `PICK A PROVIDER FIRST`。
  然后**删掉重复**：把 `ctrl.modelHint` 削到只剩门禁句以外的那半句 —— 保留「同一家供应商可以反复换模型名测。」/ 'the same provider can be tested with a different model name each time.'，删掉「先定一个模型名，再按「开始生成」」。
  顺手修掉死代码：`.mp-status` 是 `flex: none`（`web/src/styles.css:1587`），所以 `text-overflow: ellipsis`（`:1590`）**永远不会生效**，它始终按 max-content 撑开。1040px 断点下右栏 300px − 32px 内边距 = 268px，而「MODEL UNDER TEST」≈113px + 「PICK A MODEL NAME FIRST」≈166px + 8px gap ≈ 287px → 溢出，于是**让位的是没有 nowrap 的字段名**（`web/src/styles.css:1566-1575`），标签折成两行、整个区段长高约 15px。改成 `.field-head > label { flex: 0 1 auto }`、`.mp-status { flex: 0 1 auto; min-width: 0 }` —— 让截断发生在「重复句」上，而不是「唯一的名字」上。
- **建议命令**：`/impeccable clarify`。

### [P2] 喂给选择器的那张清单不可信：索引 key、静默 no-op、同一手势两次写盘、无武装的整表替换

- **What**（四处，都在 `web/src/components/ControlPanel.tsx:906-946` 与 `:298-318`）：
  1. `key={i}`（`web/src/components/ControlPanel.tsx:909`）+ `PresetRow` 里 `useEffect([value])` 重置 `draft`（`:101-103`）→ 删掉任意一行会让**它下面每一行**拿到新 value、`draft` 被静默覆盖，正在编辑但还没提交的文字无声消失。
  2. 行内提交与表尾添加在「内容没变」时 `return`（`web/src/components/ControlPanel.tsx:919-920`、`:940`）→ 打了重复名按回车，**零反馈**。
  3. 同一个手势触发两次 `saveGlobal`：在 A 行输入框里打字未提交、然后点 B 行的 ✕ —— 先 blur 提交（基于旧快照的 `cleaned`），再 `onDrop` 用**同一份旧快照**过滤后写盘（`:922-924`），后写覆盖前写，编辑丢失。`PUT /api/config` 是整表替换（`DESIGN.md:376`），所以这是真的丢更新，不是理论风险。
  4. 「恢复出厂清单」一键整表替换（`web/src/components/ControlPanel.tsx:892-899`），无武装、无撤销、无回执 —— 而同一文件里的另一处删除 `remove()` 是两段式（`:298-318`），`DESIGN.md:333` 把「同一件事只有一种长相」定为全站规则。
- **Why it matters**：这是**用户抱怨的那个空白的上游**。用户之所以会在选择器里看到 1–3 条，正是因为他手工编过这张清单；如果编辑这张清单会静默丢字、静默失败、并且能被一键抹掉，那这个工具最「便签」的表面反而比它的记录层更脆。第 4 点还让「便签」这个自我定位失效：便签不该是一键全毁的。
- **Fix**：
  1. `key={i}` → `key={m}`（`web/src/components/ControlPanel.tsx:909`）。去重保证 `m` 唯一，所以它天然是稳定 key；被删行上方的行身份不变，`draft` 不会被误重置。
  2. 把两处 `return` 改成「照旧推进 + 发回执」：表尾那处保留 `setAddKey(k => k + 1)` 并 `showReceipt(t('ctrl.presetDup'))`（新增 zh `这行已经在了` / en `ALREADY IN THE LIST`），而不是静默返回。
  3. 把提交与删除合成一次写入：`PresetRow` 提交时用函数式更新，`saveGlobal` 改为接收 `(prev: Config) => Config`，从最新 config 计算而不是从渲染闭包里的 `config`。这是根治。
  4. 「恢复出厂清单」套用与 `remove()` 完全相同的锁存：`const [restoreArmed, setRestoreArmed] = useState(false)`；第一次按下只 `setRestoreArmed(true)` 并把 label 切成 `t('ctrl.presetRestoreConfirm')`（zh `确认恢复出厂`，与「确认删除」同构），第二次才 `saveGlobal`；锁存清零放进已有的 `useEffect([selectedId])`（`web/src/components/ControlPanel.tsx:219-223`）。
  5. 顺带把清单区的失败回执从根 toast（`web/src/components/ControlPanel.tsx:336`）搬到就地通道：`.preset-head` 已经是 `justify-content: space-between`（`web/src/styles.css:1670-1677`），右槽放一个常驻 52px 的 `.prov-receipt`，复用 `showReceipt`。这才满足 `DESIGN.md:367`「两种回执都不许离开标题行」。
- **建议命令**：`/impeccable harden`（破坏性路径 + 并发写）；配 `/impeccable shape`（选择器 ↔ 清单的拓扑：目前两者只通过「滚到另一个区段」相连）。

### [P3] 一个字段里三个 live region，而唯一有用的那个读数只有读屏能听见

- **What**：`.mp-status`（`web/src/components/ControlPanel.tsx:582`）、`.mp-empty`（`:753`）、`.mp-count`（`:759`）三个 `role="status"` 挤在同一个字段里，而 `.mp-count` 是 `position:absolute; left:-10000px`（`web/src/styles.css:831-839`），**永远只能被听见、不能被看见**，并且每敲一个字符就重新播报一次。另外 `aria-expanded="true"` 是硬编码的（`web/src/components/ControlPanel.tsx:688`），永远为真 —— 读屏会被告知「有一个展开的弹出层」，而它永远收不起来，这个属性没有任何信息量。
- **Why it matters**：Operate 模式下同一次交互触发多个 live region 会产生互相打断的播报，没有优先级。更要紧的是价值判断：一个「只为读屏存在」的读数，在一个以「状态必须可见」为前提的工具里（`PRODUCT.md:62-68`）是把交易做反了 —— 视力正常的用户拿不到它，而它本来是解释那片空白的唯一线索。
- **Fix**：按 P0 把计数落到**可见的** `.mp-foot` 上，删掉 `.mp-count` 整块 CSS（`web/src/styles.css:828-839`）与 `web/src/components/ControlPanel.tsx:759-761`；`.mp-foot` 的第一个 span 保留 `role="status"`（仍然播报，但播报的是肉眼也看得见的东西）。`.mp-empty`（`:753`）去掉 `role="status"`，因为计数区已经会播报「0 个候选」—— **一个区域，一次播报**。门禁句保留为唯一的另一个区域。`aria-expanded` 删掉（列表常驻、不是弹出层，`aria-controls` + `role="listbox"` 已足够），或真的实现折叠。
- **建议命令**：`/impeccable polish`；若要机器复验 live region 数量与播报顺序，用 `/impeccable audit`。

---

## 7. Persona Red Flags

三个人设都真实成立：**键盘熟练的单人用户**（`PRODUCT.md:11` + `:73` 键盘可完成全流程）、**冷启动的新用户**（`PRODUCT.md:11` 的场景：刚拿到一批 API key）、**屏幕阅读器用户**（由 `:73` 与代码里明显的 a11y 意图共同支撑）。三人走同一条主路径：选一个模型名 → 按「开始生成」。

- **① 键盘熟练的单人用户**：Tab 进 `#o-model` → 打字 `deepseek-v3.2-reasoner` → 凹槽里 1 行，下面 190px 空白 → **按回车：什么都不会发生**（见 P1）。他必须按 ArrowDown 再回车（不可发现），或 Tab 走开靠 blur 提交。选中后从输入框到「开始生成」要经过 `.mp-clear` → `.fold > summary` → 温度 → 最大输出 **4 个 tab stop**，而门禁句在他身后 —— 没有任何「跳到主操作」的路径。
- **② 冷启动的新用户（本次抱怨的主人）**：打开 全局设置 → 模型候选清单：10 行出厂清单平铺，无分组、无重排（顺序有意义，出厂清单按厂商聚过，但他没法把常用的一条挪到顶上）。他加了自己的 2 条 → 滚回「本次运行」→ 看到 3 行 + 134px 的 `--well`，**没有计数、没有刻线、没有标注** → 结论「没存上」。次要断点：他没法从选择器里把刚打的名字「存下来」—— 必须滚到另一个区段、找到清单、再重打一遍（见 P2）。如果这台机器上名册是空的，他选好模型名后按钮仍是灰的，标签行告诉他「先选定模型名才能开始生成」—— 而框里明明有名字（见 P1 门禁）。
- **③ 屏幕阅读器用户**：输入框里打字时，`.mp-count` 每敲一个字符播报一次「3 个候选」，同时门禁区可能播报，0 命中时 `.mp-empty` 也播报 —— **同一字段三个区域互相打断**（见 P3）。`aria-expanded` 恒真。好消息：`.mp-empty` 的文案「没有候选匹配 —— 仍会用你输入的名字」**正确地在读屏路径上做了安抚**，这是这个字段里唯一一处「高利害时刻有话说」的地方。

---

## 8. Minor Observations

1. **IME 是真 bug，不只是「已知未修」**：`web/src/components/ControlPanel.tsx:631-676` 的 `onKeyDown` 没有 `e.nativeEvent.isComposing` 守卫，拼音候选词提交的那次回车会走进 `e.key === 'Enter'` 分支。目前只靠「打字时 `activeIdx` 恒为 -1」侥幸避开 —— 这是 P1（回车）的**前置条件**。
2. **`.preset-list` 没有 padding**（`web/src/styles.css:1681-1687`），而 `DESIGN.md:162` frontmatter 写着 `padding: 5px 8px`。**实现是更好的那一份**（padding 交给行自己的 `5px 8px`，与 `.mp-grid` 的处理一致），错的是文档。
3. **`web/src/components/ControlPanel.tsx:765` 的 `style={{marginTop:8}}`** 覆盖了 `.note` 类自己的 `margin-top:10px`（`web/src/styles.css:1655-1662`），类里的值在这个位置是死代码。在一个几乎全用 class 的文件里，这一处内联样式是味道。
4. **`.mp-cell` 没有 `min-height`**；`pointer: coarse` 下靠媒体查询抬到 44px（`web/src/styles.css:2318-2320`），三行 = 134px，与桌面 220px 是**两个不同的常数**。实测触屏档（390×900）`block-size: 134px`、cell 44px、clientHeight 132 → 3 条正好占满（0px 空带）、2 条 → 44px、1 条 → 88px，`.arm` top 恒为 875.31。**同一个「矮窗口」论证在矮桌面窗口上同样成立**，只是没人给它写一个断点。
5. **滚动条是被主题化的**（`web/src/styles.css:153-168`，`scrollbar-width: thin` + `--engrave-hi`），所以 10 条清单确实有滚动条 —— 但它细、且只在溢出时出现，作为「这里还有内容」的提示太弱。注意 `tools/edge-cdp.mjs:59` 硬编码了 `--hide-scrollbars`，**任何截图里都看不到滚动条**，不能拿截图说「没有滚动条指示」。
6. **「恢复出厂清单」的 `disabled` 用 `JSON.stringify` 比较数组**（`web/src/components/ControlPanel.tsx:895`），顺序敏感：把清单重排一遍（内容集合不变）按钮就会变可用。考虑到顺序在这里有意义（出厂清单按厂商聚），这大概是对的，但值得知道它比较的是序列不是集合。
7. **清单编辑器没有拖拽/重排**，而顺序有意义。把常用的一条从第 8 位移到第 1 位，目前只能靠删掉再重打。
8. **`.preset-drop` 宽度 29px**（`web/src/styles.css:1734-1743`），注释说明它等于 `.mp-clear` 的宽度，理由是「这个站里『一格动作』只有这一个尺寸」—— 这是一条好规则，执行得也对。触屏下抬到 `--switch-h` 44px 的理由（29px 是「瞄第 3 行、删了第 4 行」的宽度）也是对的。
9. **`DESIGN.md:374` 还有第二处过期**：它写「无命中时整格印 `没有匹配的模型名`」，而实际出厂文案是「没有候选匹配 —— 仍会用你输入的名字」（`web/src/i18n.ts:130-133`）。文档在这一行上有两处与实现不符（`max-height` 与空态文案）。
10. **检测器在本模块上零信号，且这个 0 无效**：`impeccable.cmd detect --json web/src/components/ControlPanel.tsx` → stdout 恰为 `[]`，exit 0，0 findings（目录作用域 `web/src/components` 同样为 0）。上一轮评审做过灵敏度标定：6 个刻意违规的探针文件中 5 个也返回 0 findings，**非 HTML 目标走正则模式，灵敏度极低**。所以这个 0 不能为本模块背书，也不能被引用为「干净」。
11. **页内检测器（同一 skill）上次在同一页面上报过 `[impeccable] 49 anti-patterns found`**，规则只有 `dark-glow`（`span.lamp.*`）与 `undersized-ui-text`（10.5px 的 `span.tag.*`），**51 条里 0 条提到模型选择器**。本次因禁止起新服务器（overlay 注入需要 `live-server`）而未复现，如实记为未获取。
12. **减少动态效果无风险**：`--reduce` 下 picker 内 `transitionDuration` 由 `0s` 变 `1e-06s`，`animationName` 两种模式都是 `none`，`.mp-dot::after` 的琥珀辉光是静态 `box-shadow` 不是动画。模块内没有任何运动。

---

## 9. Questions to Consider

1. **如果凹槽必须定高，因为「仪器上的槽位不因为读数变了就换位置」—— 那么这个槽位里的读数是什么？** 仪器的空窗要么是 0，要么是故障灯；它从来不是「没有」。220px 到底是一个槽位，还是一块从来没被给过画面的屏幕？
2. **出厂清单 10 条，窗口装得下 7.79 行。这个 220px 是照谁的清单量的？** 如果预期用户会自己收窄到 3–5 条，为什么默认给 10 条、而窗口给 8 行？
3. **`PRODUCT.md` 要求每条记录单张截图自洽。控制台算不算记录？** 如果用户截整窗给同事看「这工具长什么样」，主按钮上方那 190px 的空洞，是这台仪器唯一的自我介绍。
4. **模型名被刻意不挂在供应商上，因为「存下来就会毁掉这个工具唯一要做的比较」（`PRODUCT.md:37`）。可是候选清单是全局存的。这个区别在选择器里被表达了吗？** hint 说了清单不挡任何一次运行，但没有任何地方说清单不是「每家供应商一份」。
5. **全站只有一种删除长相（按两下），这是 `DESIGN.md:333` 的敕令。而模型候选清单有一处秒删 ✕、一处一键恢复出厂。哪一处是意外？**
6. **如果「按钮绝不许动」是真的，为什么这条约束只在选择器里被强制？** 删掉一个供应商行会把「开始生成」往上推 44px 以上，展开「参数单独设置」会推它 —— 名册那一整段的伸缩没人管。这条约束是全局不变量，还是这一处的免责声明？如果它只是「用户主动操作可以动、过滤收窄不可以动」，那这个区分本身需要被写下来，因为它现在没有。
