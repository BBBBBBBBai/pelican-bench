# Audit — 动物骑单车测试台 (Animal Bike Bench)

Audit date: 2026-10-07 · Scope: `web/src` + `server/` + `shared/` + built output · Method: bundled detector, headless-Edge runtime probes on the production build (`http://127.0.0.1:8787/`) and the dev server (`http://127.0.0.1:5174/`), plus static reading of every source file.

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2/4 | 标本页不接管也不关住焦点：打开后 12 次真实 Tab 全部落在遮罩后面的格子上（WCAG 2.4.3） |
| 2 | Performance | 4/4 | 生产 29 请求 / 370KB / FCP 92ms / 零长任务 / 零控制台错误 |
| 3 | Responsive Design | 3/4 | 12 个视口零溢出零裁切，但 `.sw` 按钮高 22px、`.btn` 高 32px，低于 44px 触控标准 |
| 4 | Theming | 3/4 | 令牌系统完整，但缺 `color-scheme: dark`，且有 2 处违反明令声明的外观漂移 |
| 5 | Implementation Integrity | 2/4 | 结构高度自洽，但 `modelMatches` 的前缀包含会把「模型降级」记成干净成功——工具存在的理由被绕过 |
| **Total** | | **14/20** | **Good（address weak dimensions）** |

## Implementation Integrity Verdict

**PASS on coherence — FAIL on defect count.** 这套实现是一个连贯的、只属于这个产品的系统，不是可互换的通用界面：暗色阳极氧化面板 + 丝印标签 + 凹陷读数窗 + 琥珀指示灯是唯一的世界，`web/src/styles.css` 里每一处尺寸、字距、颜色都指向同一个身份；`impeccable.cmd detect --json web/src` 返回 `[]`（全项目 26 条发现全部落在我自己写的 `tools/probe-*.js` 探针脚本里，出货代码零发现）。SVG 三重安全（`<img>` 走 API、`sandbox=""` iframe + 内联 CSP、显示前 sanitize）、`.tmp` + rename 原子写盘、密钥永不出后端、真实防穿越——这些不是"注意到的优点"，是把它当仪器造的证据。

但"逻辑自洽"不等于"事实正确"。审计坐实了 25 个缺陷，其中两个直接损害产品的核心主张：`server/runner.ts:97` 的 `return a.includes(b) || b.includes(a);` 让 `gpt-4o → gpt-4o-mini` 这类中转站最典型的降级被判成一致；`server/runner.ts:250` 的 `if (extracted && …)` 让"换了模型且返回散文"的记录只剩 `not-svg` 一个标签。这是一台用来抓降智信号的仪器，而它在最典型的降智手法上漏判。

## Executive Summary

- **Audit Health Score: 14/20 (Good)**
- **Total issues: 25** — P0: 0 · P1: 5 · P2: 10 · P3: 10
- **Top 5：**
  1. **标本页焦点逃逸**：`role="dialog" aria-modal="true"` 齐备，但不接管焦点、背景不 inert，键盘用户 Tab 出去在看不见的内容里走（P1）
  2. **`modelMatches` 前缀包含漏判降级**：`gpt-4o` 与 `gpt-4o-mini` 判为一致 → 干净成功（P1）
  3. **没有 SVG 时 `model-mismatch` 永不记录**：换模型的事实被 `extracted` 条件丢掉（P1）
  4. **toast 不播报**：全站零 `aria-live`/`role=status`，运行失败对辅助技术不可见（P1）
  5. **客户端中文诊断串进英文界面**：`web/src/lib/svgCheck.ts` 的 `'空内容'` 等四个字面量经 `flag.detail` 直达 UI（P1）
- **下一步**：先 `/impeccable harden`（焦点管理 + 异常判定逻辑 + 服务端错误边界），再 `/impeccable adapt`（触控尺寸 + 无障碍名与地标），再 `/impeccable quieter` + `/impeccable colorize`（两处外观漂移 + `color-scheme`），最后 `/impeccable polish`。

## Detailed Findings by Severity

### P1 — Major

**[P1] 标本页不接管焦点，也不把焦点关在里面**
- **Location**: `web/src/components/SpecimenSheet.tsx:75`（`role="dialog" aria-modal="true"` 但无 `tabIndex`、无 focus 调用）、`web/src/App.tsx:101-109`
- **Category**: Accessibility
- **Impact**: 从格子打开标本页后，真实 Tab 走 12 站全部落在全屏遮罩**后面**的格子上（`第 15 条` → `第 05 条`），键盘用户在一个看不见的列表里走；`grep inert|autoFocus|tabIndex|\.focus\(` 在 `web/src` 零命中。Escape 关闭是好的（关后焦点正确回到触发的格子）。
- **WCAG**: 2.4.3 Focus Order (A)、2.1.2 No Keyboard Trap 的反面（焦点本应被限制在模态内）
- **Evidence**: `tools/probe-sheet-ax.mjs` + `tools/audit-interact.mjs`（真实 `Input.dispatchKeyEvent`）→ `focusAfterOpen: "BODY."` / `inSheet=false`；`sheetFocusEscape: 12`
- **Recommendation**: 面板容器加 `tabIndex={-1}` 并在打开时 `.focus()`；背景根节点（`.bay` / `.panel`）在打开期间加 `inert`；或实现首尾焦点环
- **Suggested command**: `/impeccable harden`

**[P1] `modelMatches` 用子串包含判定，把「模型降级」判成一致**
- **Location**: `server/runner.ts:91-98`，核心行 `server/runner.ts:97` `return a.includes(b) || b.includes(a);`
- **Category**: Implementation Integrity
- **Impact**: 归一化后 `"gpt4omini".includes("gpt4o")` 为真，所以 `gpt-4o → gpt-4o-mini` 记录为 `ok`。中转站最常见的降级手法正好落在这个洞里——工具存在的理由被绕过。
- **WCAG/Standard**: —
- **Evidence**: `tools/probe-modelmatch.mjs` 实测 9 组：`"gpt-4o"→"gpt-4o-mini" = true`、`"gpt-4o-mini"→"gpt-4o" = true`、`"deepseek-v3.2-reasoner-preview"→"deepseek-v3" = true`；只有 `"gpt-4o"→"gpt-3.5-turbo" = false`。注意现有 26 条演示记录里的 `model-mismatch` 来自 `tools/mock-provider.mjs:284` 的 `totally-different-model-v9`——**恰好是"名字完全不同"那种，不能当反例**。
- **Recommendation**: 改为「精确相等，或返回名以请求名 + `-` / `:` / `@` 开头（版本/日期后缀）」，并显式拒绝已知的档位后缀（`-mini` / `-nano` / `-lite` / `-flash` / `-air`）；日期快照后缀（`-2024-08-06`）继续放过
- **Suggested command**: `/impeccable harden`

**[P1] 没有可抽取的 SVG 时，`model-mismatch` 永不记录**
- **Location**: `server/runner.ts:250` `if (extracted && !modelMatches(target.model, responseModel)) {`
- **Category**: Implementation Integrity
- **Impact**: `responseModel` 在 `server/runner.ts:185` `if (chunk.responseModel) responseModel = chunk.responseModel;` 已捕获在手，却被 `extracted` 条件整条丢掉。换了个模型、又返回散文的记录只剩 `not-svg`，"换模型"这个事实消失。同函数其余判断（`aborted` / `timeout` / `http-error` / `not-svg` / `truncated`，`server/runner.ts:228-248`）都不要求 `extracted`。
- **WCAG/Standard**: —
- **Recommendation**: 把 `extracted` 从该条件里去掉——模型不一致与有没有画出图是两个独立事实
- **Suggested command**: `/impeccable harden`

**[P1] Toast 不播报，运行失败对辅助技术不可见**
- **Location**: `web/src/App.tsx:216` `{toast && <div className={\`toast${toast.err ? ' error' : ''}\`}>{toast.msg}</div>}`
- **Category**: Accessibility
- **Impact**: `grep aria-live|role=status|role=alert` 在 `web/src` 零命中；运行失败（`web/src/App.tsx:80`、`:85`）与删除确认只靠视觉。屏幕阅读器用户得不到任何反馈。
- **WCAG**: 4.1.3 Status Messages (AA)
- **Evidence**: `tools/probe-sheet-ax.mjs` → `liveRegions: []`；`tools/probe-a11y.js` → `liveRegions: []`
- **Recommendation**: toast 容器加 `role="status"`（错误用 `role="alert"`），并保留视觉文案不变
- **Suggested command**: `/impeccable harden`

**[P1] 客户端中文诊断串直达英文界面**
- **Location**: `web/src/lib/svgCheck.ts:13` `return { ok: false, reason: '空内容' };`、`:16`/`:19` `'没有 <svg> 根节点'`、`:24` `'XML 解析失败'`、`:26` `'根节点不是 svg'` → `web/src/components/SpecimenSheet.tsx:54` → `flag.detail` → 渲染于 `web/src/components/SpecimenSheet.tsx:213` `{t(\`flag.${f.code}\`)} — {f.detail}`
- **Category**: Implementation Integrity
- **Impact**: `web/src/i18n.ts:5` 的例外只覆盖**服务端**写进 `flag.detail` 的诊断串；`web/src/lib/svgCheck.ts` 是客户端文件，四个字面量在英文界面显示为中文。同一违反类别还有 `web/src/components/BusBar.tsx:85` 的 `label="language"`（AX 实测组名为 `"language"`，中文界面下也是英文）。
- **WCAG**: 3.1.2 Language of Parts (AA)
- **Recommendation**: 把四个 reason 改成 `i18n` key 或错误码（如 `'empty'` / `'no-root'` / `'parse-failed'` / `'root-not-svg'`），在渲染处 `t(\`svgcheck.${code}\`)`；`label="language"` 改走 `t()`
- **Suggested command**: `/impeccable clarify`

### P2 — Minor

**[P2] 全站零标题零地标**
- **Location**: `web/src/App.tsx:160`；`grep <h1|<h2|<h3|<main|<nav|<header` 在 `web/src` 零命中
- **Category**: Accessibility · **Impact**: 屏幕阅读器无法按标题或地标跳转；段落标题是 `<span className="silk silk-hi">`（`web/src/components/ControlPanel.tsx:38`、`web/src/components/SpecimenSheet.tsx:147`），机架 `<section key={rack}>`（`web/src/components/Rack.tsx:255`）无名。`landmarks {main:0, nav:0, header:0, aside:0, section:4, footer:0}`、`headings: []`
- **WCAG**: 1.3.1 (A)、2.4.6 (AA)
- **Recommendation**: `.bay` → `<main>`，右栏 → `<aside>`，段落标题改 `<h2>`（样式用现有 `.bay-head .silk` 保持不动），机架 `<section>` 补 `aria-label`
- **Suggested command**: `/impeccable adapt`

**[P2] 格子的无障碍名是六个事实连读，专门写的 `title` 被忽略**
- **Location**: `web/src/components/Rack.tsx:56` `title={t('ch.open', { animal })}`
- **Category**: Accessibility · **Impact**: 按钮自身内容提供 accname，按规范 `title` 被忽略。AX 实测名为 `"43.0s 第 01 条 图形无法显示 企鹅 a6 gpt-6.1-sol 2026-10-07 17:09 已中止 输出截断 渲染失败"`，而描述才是 `"打开 企鹅 的详情"`——动词落到了 description，名字里没有。
- **WCAG**: 2.4.6 (AA)、4.1.2 (A)
- **Evidence**: `tools/probe-accname.mjs`（CDP `Accessibility.getPartialAXTree`）
- **Recommendation**: 给格子加 `aria-label={t('ch.open', { animal })}`（或把事实包一层 `aria-hidden`），让名字是"打开 X 的详情"，事实仍留在 DOM 里可读
- **Suggested command**: `/impeccable adapt`

**[P2] 题目语言切换组无名，且它的可见标签是孤儿 `<label>`**
- **Location**: `web/src/components/ControlPanel.tsx:417` `<label>{t('ctrl.promptLang')}</label>`（无 `htmlFor`、不包裹控件）+ `:418-426` `<Switch>` 未传 `label`
- **Category**: Accessibility · **Impact**: AX 实测该组 `{role:'group', name:''}`，点击可见标签也不生效
- **WCAG**: 4.1.2 (A)、1.3.1 (A) · **Recommendation**: 与 `web/src/components/BusBar.tsx` 的用法对齐，传 `label={t('ctrl.promptLang')}` 并删掉孤儿 `<label>`
- **Suggested command**: `/impeccable adapt`

**[P2] `label="language"` 硬编码英文**
- **Location**: `web/src/components/BusBar.tsx:85` → `web/src/components/bits.tsx:93` `aria-label={label}`
- **Category**: Implementation Integrity · **Impact**: 中文界面下语言切换组仍叫 "language"（AX 实测确认）；`web/src` 里 `aria-label` 只有三处，另两处（`web/src/components/Rack.tsx:175`、`web/src/components/bits.tsx:93`）都走了 `t()`
- **WCAG**: 3.1.2 (AA) · **Recommendation**: 加 `rail.lang` / `a11y.language` 键
- **Suggested command**: `/impeccable clarify`

**[P2] 详情请求无竞态保护，点快了会显示错的那条**
- **Location**: `web/src/App.tsx:101-109` `void api.getRecord(id).then(setDetail).catch(…).finally(…)`
- **Category**: Implementation Integrity · **Impact**: 无条件写入 `detail`，快速连点两个格子时慢的那个会覆盖新的——标本页显示的不是你点的那份标本，而这是"靠肉眼判断"的工具
- **Recommendation**: 记请求序号或 id 比对后再 `setDetail`
- **Suggested command**: `/impeccable harden`

**[P2] 改 `dataDir` 后 `listRecords()` 仍返回旧目录**
- **Location**: `server/index.ts:69` `writeConfig(next);`（`dataDir` 在 `server/index.ts:52` 可写）+ `server/storage.ts:22` `function invalidate(): void {`（**未 export**）+ `server/storage.ts:138` `if (cache) return cache;`
- **Category**: Implementation Integrity · **Impact**: `invalidate()` 只被 `server/storage.ts:136`（saveRun 后）、`:198`（deleteRecord）、`:211`（patchRecord）内部调用，`server/index.ts` 无一处调用 → 改配置后仍列旧目录。**现实影响有限**：界面没有改 `dataDir` 的控件（`web/src/components/ControlPanel.tsx:481` 只显示路径），只能直接打 API 触发，属潜伏缺陷。
- **Recommendation**: `export function invalidate()` 并在 `server/index.ts:69` 写配置后调用
- **Suggested command**: `/impeccable harden`

**[P2] `[DONE]` 之后不取消上游 socket**
- **Location**: `server/chat/openai.ts:30` `if (evt.data === '[DONE]') break;` → `server/chat/types.ts:82` `reader.releaseLock();`（`finally` 内）
- **Category**: Performance · **Impact**: 子代理复现：加 `controller.abort()` 后上游才看到 socket 关闭，不加则 `NEVER (connection still open)`。`server/runner.ts:221` 的 `finally { clearTimeout(timer); }` 只清定时器。上游连接被白留到最后。
- **Recommendation**: 跳出读取循环后调用 `reader.cancel()`（或在 `finally` 里对未结束的响应 `abort()`）
- **Suggested command**: `/impeccable optimize`

**[P2] 缺 `color-scheme: dark`，下拉弹层按亮色渲染**
- **Location**: `web/src/styles.css` 全表无 `color-scheme`（`grep` 零命中）、`web/index.html` 无 `<meta name="color-scheme">`
- **Category**: Theming · **Impact**: 实测 `html/body/select` 三处均为 `color-scheme: normal`。`appearance: none` 只拿掉控件外壳，拿不掉 `<select>` 弹出的**列表本身**——一台暗色仪器上唯一还发白的东西。
- **Evidence**: `tools/probe-colorscheme.js` → `{"htmlColorScheme":"normal","bodyColorScheme":"normal","selectColorScheme":"normal","metaColorScheme":null}`；对照 `caretColor: rgb(240,160,32)`、`scrollbarColor: rgb(61,58,52) rgba(0,0,0,0)` 都已上色
- **Recommendation**: `:root { color-scheme: dark }`
- **Suggested command**: `/impeccable colorize`

**[P2] 两处外观漂移违反设计系统明令**
- **Location A**: `web/src/styles.css:1153-1159` `.check input:checked::after { … box-shadow: 0 0 4px rgba(240,160,32,0.7) }` —— 6×6 方块上的**零偏移**琥珀光晕，不是灯
- **Location B**: `web/src/styles.css:1432-1440` `.toast { position: fixed; … box-shadow: 0 6px 20px rgba(0,0,0,0.6) }` —— 全站唯一一处"投出影子"的浮起物
- **Category**: Theming · **Impact**: A 违反 The Light-Only-From-Lamps Rule（DESIGN.md:280）、"Don't 发光"（:360）、"零偏移彩色光晕是装饰"（:363）三条；B 违反"没有投影，深度全部由凹进去和刻上去表达，而不是由浮起来表达"（:156）与"这套系统没有浮起来的东西"（:269）。两处都不在 DESIGN.md:173-184 的"有意派生值"名单内。
- **Recommendation**: A 删掉那行 `box-shadow`（实心方块已经够清楚）；B 换成 1px `--engrave-hi` 边框 + 内嵌高光（已具备），或把示例写进 DESIGN.md 的授权名单——但不能两边都留着
- **Suggested command**: `/impeccable quieter`

**[P2] 触控目标高度低于 44px**
- **Location**: `web/src/styles.css:443-459` `.sw > button`（`padding: 5px 10px` + 11px 字 → 实测 22px 高）、`web/src/styles.css:1010-1082` `.btn`（实测约 32px 高）
- **Category**: Responsive Design · **Impact**: 实测 9 个工具轨开关（`NEWEST 68.7×22` … `ISSUES ONLY 94.7×22`）与"复位"按钮（`RESET 86.3×32`）都低于 44px 下限。触屏上按错概率偏高。
- **Recommendation**: 保持视觉不变，用伪元素或 `padding` 把命中区撑到 ≥44px（`.sw > button` 需要 `.sw` 容器允许溢出高度，或让整段 `.rail` 行高 44）
- **Suggested command**: `/impeccable adapt`

### P3 — Polish

**[P3] 消毒器漏 `/` 分隔的事件属性** — `shared/svg.ts:79-84` 三条规则都要求前置空白（`\son[a-z]+…`）。实测 `tools/probe-sanitize.mjs`：`<svg onload="alert(1)">` 清掉、`<svg\nonload=…>` 清掉，**`<svg/onload=alert(1)>` 原样通过**。定性必须是纵深防御——三个 sink（`<img>` `web/src/components/Rack.tsx:68`、`sandbox=""` iframe `web/src/components/SvgFrame.tsx:26`、CSP `default-src 'none'` `server/index.ts:256-259`）都不执行脚本。**修**：规则改成 `[\s/]on[a-z]+`。`/impeccable harden`

**[P3] 没有 express 错误处理器** — `server/index.ts` 只有 `:23` `express.json({limit:'2mb'})` 与 `:275` 静态托管，全文件无 `(err,req,res,next)`。实测 `PUT /api/config` 带 3MB body → `413 text/html`，body 是 body-parser 的 HTML 错误页，被 `web/src/api.ts:20 if (!res.ok)` 当消息塞进 toast。**修**：补一个返回 JSON 的错误中间件。`/impeccable harden`

**[P3] PATCH 可伪造 flag code，且删不掉任何 flag** — `server/index.ts:225-238` 按 code 求并集（`if (!f?.code) continue;` … `else merged[idx] = f;`），任意 code 落盘且无法移除（实测：加 `__probe__` 成功，再 PATCH 剩余项无法删掉它）。未知 code 经 `web/src/components/bits.tsx:69` `{t(\`flag.${f.code}\`)}` → `web/src/i18n.ts:210` `let out: string = entry ? entry[lang] : key;` 原样显示成 `flag.__probe__`。**修**：服务端用已知 code 白名单过滤，未知 key 回退成通用文案。`/impeccable harden`

**[P3] `timeout` 可能盖在已完成的响应上** — `server/runner.ts:232-234` 用 `timedOut` 打标，而 `timedOut` 由 `server/runner.ts:168-171` 的定时器置位、只在下一轮 attempt 开头 `server/runner.ts:152 timedOut = false;` 重置。流压着 deadline 完成时定时器已置真并 abort，但数据已收全 → 复现得 `FINAL flags = ["timeout"] | lastError = null`。**修**：成功消费完整流后清 `timedOut`。`/impeccable harden`

**[P3] `render-failed` 对「文件读不到」也触发** — `web/src/components/Rack.tsx:70-76` `<img onError>` 对任何加载失败都触发，而 `/api/records/:id/svg` 在 sidecar 丢失时 404（`server/index.ts:249-255`）。渲染失败与文件丢失被记成同一个事实。**修**：区分 HTTP 状态或先探测存在性。`/impeccable harden`

**[P3] 前端 SSE 尾帧可能丢** — `web/src/api.ts:116-134` 的 `if (done) break;` 退出时未 flush `buffer`；对照 `server/chat/types.ts:78-80` 的服务端读取器**有**尾帧处理（`const tail = buffer.trim(); if (tail.startsWith('data:')) yield {…}`）。分帧本身正确（从 buffer 切行、去 `\r`、跳空 `data:`，无重复无半帧）。**修**：循环后按同样方式 flush 一次。`/impeccable harden`

**[P3] 保存路径同步且每天 O(N²)** — `server/storage.ts:29-40` `nextChannel()` 每次 saveRun（`server/storage.ts:125` `channel: nextChannel(dir),`）都把当天所有 JSON 重读重解析一遍，`:97-136` 全是 `*Sync`，流式生成期间阻塞事件循环。**实测**：26 条记录时单次 1.5ms（中位）/ 2.0ms（最大）——当前规模无影响，500 条时约 29ms/次。**修**：目录 mtime 缓存或内存计数器。`/impeccable optimize`

**[P3] PATCH 后 `ok` 与 `flags` 矛盾** — `ok` 只在 `server/runner.ts:259` `const ok = Boolean(extracted) && flags.length === 0;` 算一次，PATCH（`server/index.ts:237`）只并入 flags 不重算，于是磁盘上可以出现 `ok: true` + `render-failed`。**显示层不受影响**（`web/src/components/bits.tsx:42-43` 的 `lampOf` 先看 flags；`web/src/components/Rack.tsx:137` 用 `r.flags.length === 0`），是纯数据一致性问题。`/impeccable harden`

**[P3] 第二处入场动画与 DESIGN.md 四处声明矛盾** — `web/src/styles.css:1188-1208` `.sheet { animation: sheet-in 0.24s … }` + `@keyframes sheet-in`（`opacity` + `clip-path: inset(7% 3% 7% 3%)` + `filter: blur(4px)` → none）。DESIGN.md:167 / :367 / :265 / :342 四处都写"全世界只有一个编排动作：`lamp-strike`，别处不做入场动画"。好消息：`prefers-reduced-motion` 下被压成 `1e-06s` 且终态完整保留（实测 `opacity:1 / filter:blur(0px) / clipPath:inset(0%)`）。**修**：删掉 `sheet-in`，或把这条例外写进 DESIGN.md。`/impeccable animate`

**[P3] 其它小项** — 13 个死 i18n 键（`rail.anyProfile` `web/src/i18n.ts:42`、`rack.total` `:54`、`live.done` `:82`、`live.aborted` `:83`、`live.failed` `:84`、`live.rendered` `:85`、`live.openSheet` `:86`、`ctrl.newProfile` `:92`、`ctrl.hasKey` `:106`、`run.running` `:122`、`sheet.rawOnly` `:158`、`run.startFailed` `:201`、`detail.chars` `:202`，逐个 grep 确认只在自己那一行命中；另 7 个 `flag.*` 是 `t(\`flag.${f.code}\`)` 动态取用，不能删）；`web/src/components/SpecimenSheet.tsx:40` `const verdict = svg ? checkSvg(svg) : {…}` 每次渲染重跑正则 + `new DOMParser()`；`web/src/components/Rack.tsx:59/:66/:85` 把 `<div>` 嵌在 `<button>`（`:52`）里（内容模型无效）；`web/src/components/SpecimenSheet.tsx:62-69` blob URL 在 `a.click()` 同任务 `revokeObjectURL`；`web/index.html:6` `<title>动物骑单车测试台</title>` 硬编码且全站无 `document.title` 赋值（`web/src/App.tsx:60` 只同步了 `documentElement.lang`）；`web/src/components/SvgFrame.tsx:26` `title={title ?? 'svg'}` 字面量。`/impeccable distill`

## Patterns & Systemic Issues

1. **无障碍只做到了"标记层"，没做到"行为层"**（4 个 P1/P2）：`role` / `aria-pressed` / `aria-label` / `alt=""` 全部正确，标签关联也正确（AX 实测复选框名为「保存思考过程」）。缺的全是需要**运行时行为**的那部分：焦点移交与围栏、状态播报、标题与地标。这正是"逐个元素检查都对、整体体验仍然断"的典型形态。
2. **异常标签的判定逻辑比它的记录结构弱**（2 个 P1）：`flags` 数组、`ok` 计算、标签渲染都很干净；但决定"要不要贴标签"的三处判断（`modelMatches` 的子串包含、`extracted` 门禁、`timeout` 的粘滞标志）都会漏。**这个工具的全部价值就是把标签贴对**，所以这三处应按核心逻辑对待，不是边缘分支。
3. **`i18n.ts:5` 的那条例外线画在了错误的地方**（3 个 P1/P2）：例外的原意是"服务端写进 `flag.detail` 的诊断串属于数据"。实际执行时，**客户端**文件（`web/src/lib/svgCheck.ts`）和**服务端 HTTP error body**（`server/index.ts:103` 等 7 处）都借这条线溜进了 `t()` 之外，英文界面因此混着中文。
4. **DESIGN.md 的强声明与实际外观有两处未同步**（1 个 P2 + 1 个 P3）：光只从灯里出来 / 没有浮起来的东西 / 只有一个编排动效——这三条都是"世界设定"级的强声明，恰恰是最容易被后续小改动破坏的。要么改代码，要么改文档，不能让两者并存。

## Positive Findings

- **性能维度全绿**（生产构建，`http://127.0.0.1:8787/`）：29 个请求 / 370KB / `ttfb 3ms` / `domContentLoaded 24ms` / `FCP 92ms` / `longTasks []` / `consoleErrors []` / `LayoutCount 5` / `LayoutDuration 0.038s` / 537 DOM 节点。字体预载生效（`dist/web/index.html` 已由 Vite 重写为 `/assets/*.woff2` preload）。图片 `loading="lazy"` + `decoding="async"` 生效（`imgsInViewport 5` 对 `totalImgs 20`）。
- **响应式 12/12 视口零缺陷**（`tools/audit-responsive.mjs`）：1440 / 1041 / 1040 / 1039 / 901 / 900 / 899 / 621 / 620 / 619 / 390 / 320 全部 `ofx=0 ovf=0 clip=0`，四个断点两侧行为都正确且连续（1040 上/下只差 0.3px 的 `--ch-min`；620 处 `--ch-min` 199.656 且铭牌副行隐藏）。
- **真实手势与真实键盘都验过**（`tools/audit-interact.mjs`，headless Edge + `Input.dispatchTouchEvent` / `Input.dispatchKeyEvent`）：30 个 Tab 站 30/30 有可见焦点指示；`.rack-scroll` 触摸滑动 165px、`.panel-scroll` 59px，`pageMoved: 0`（不吞页面滚动）；页面缩放 1.5/2/3 下 `docOverflowX` 恒 0、工具轨恒 `sticky`。**未测**：真机（iOS/Android）触感与软键盘行为。
- **`prefers-reduced-motion` 是"保留状态变化的替代"，不是"全局清零"**：实测 `reducedAnimations: []`，标本页动画被压成瞬时但终态完整（`opacity:1 / filter:blur(0px) / clipPath:inset(0%) / visible:true`）。
- **SVG 三重安全**：`<img src="/api/records/{id}/svg">`（`web/src/components/Rack.tsx:68`）、`sandbox=""` iframe + 内联 CSP（`web/src/components/SvgFrame.tsx:26`、`shared/svg.ts:141`）、显示前 sanitize（`shared/svg.ts:78-106`）；`web/src` 内零 `dangerouslySetInnerHTML` / `innerHTML`。
- **服务端卫生**：密钥永不出后端（`server/index.ts:33` 只回 `hasKey: boolean`，`server/` 全目录无 `console.*` 带 key）；`server/storage.ts:175` 真实防穿越；`server/storage.ts:104-105` / `:133-134` 每次写入 `.tmp` + rename；`server/index.ts:177-182` abort 监听 `res` 而非 `req`（注释记录了踩过的坑）且在模拟中途断开下无未捕获异常；无 CORS 头 + 只绑回环（`server/index.ts:281`）。
- **交互层无一处偷懒**：`web/src` 全部点击处理器都在真 `<button>` / `<select>` / `<input>` 上；切换组都有 `aria-pressed`；列表 key 全用稳定 id；组件内联样式里零硬编码 hex / rgba / px 字号 / 字体族（31 处 `style` 只设布局与间距，颜色全走 token）；`as any` / `@ts-ignore` / `@ts-expect-error` 零命中，`tsconfig.json` 是 `strict` + `noUnusedLocals` + `noUnusedParameters`；`!important` 只出现在 `prefers-reduced-motion` 块里。
- **i18n 字典零缺语言**：143 个键，zh/en 全成对；**英中长度比平均 2.29×**（极端如 `rail.mid` 1→6），这是排版压力的真实来源，也是上一轮 typeset pass 把 `.slot-name` / `.slot-sub` 改成允许折行的依据。
- **检测器干净**：`impeccable.cmd detect --json web/src` → `[]`（改前改后都是空集）。全项目 26 条发现全部落在我自己写的 `tools/probe-*.js` 探针脚本里，出货代码零发现。

## Recommended Actions

1. **[P1] `/impeccable harden`** — 焦点移交 + 背景 `inert`（`web/src/components/SpecimenSheet.tsx:75`）、toast 加 `role="status"`/`alert`（`web/src/App.tsx:216`）、`modelMatches` 改为版本后缀白名单（`server/runner.ts:97`）、去掉 `model-mismatch` 的 `extracted` 门禁（`server/runner.ts:250`）、`export invalidate()` 并在写配置后调用、`reader.cancel()`、详情请求竞态、express 错误中间件、消毒器 `[\s/]on[a-z]+`。
2. **[P1] `/impeccable clarify`** — 把 `web/src/lib/svgCheck.ts` 四个中文字面量改成错误码 + i18n key；`web/src/components/BusBar.tsx:85` 的 `label="language"` 走 `t()`；服务端 7 处硬编码中文 error body（`server/index.ts:103` 等）改成 code + 前端翻译。
3. **[P2] `/impeccable adapt`** — 补 `<main>`/`<aside>`/`<h2>` 与机架 `aria-label`；格子加 `aria-label`；题目语言切换组补名并删孤儿 `<label>`；`.sw` / `.btn` 命中区撑到 ≥44px 而视觉不变。
4. **[P2] `/impeccable quieter`** — 删掉 `web/src/styles.css:1153-1159` 的零偏移琥珀光晕；处理 `web/src/styles.css:1432-1440` 的 toast 投影（改代码或改 DESIGN.md 授权名单）。
5. **[P2] `/impeccable colorize`** — `:root { color-scheme: dark }`（`tools/probe-colorscheme.js` 实测三处均为 `normal`）。
6. **[P3] `/impeccable animate`** — `sheet-in` 与 DESIGN.md 四处"只有一个编排动效"的声明二选一。
7. **[P3] `/impeccable optimize`** — `server/storage.ts:29-40` 的保存路径缓存化；`[DONE]` 后取消上游 socket。
8. **[P3] `/impeccable distill`** — 删 13 个死 i18n 键；`checkSvg` 加 memo；`<div>` 移出 `<button>`。
9. **[Final] `/impeccable polish`** — 收口全部改动，复跑 `impeccable.cmd detect --json web/src` 与 `npm run typecheck`。

## Evidence Index

| 文件 | 覆盖内容 |
|---|---|
| `.impeccable/review/a11y-main.json` | 地标/标题/ARIA/表单关联/图片 alt/滚动容器/触控尺寸 |
| `.impeccable/review/a11y-sheet.json` | 标本页 dialog 语义、打开后焦点位置、Escape、iframe |
| `.impeccable/review/a11y-scale.json` | `:focus-visible` 规则、根字号缩放、全站 px 字号计数 |
| `.impeccable/review/audit-interact.json` | 真实键盘 30 站焦点环、真实触摸滚动、reduced-motion、页面缩放 |
| `.impeccable/review/perf-prod.json` | 生产构建网络瀑布与关键时间点、长任务、渲染代价、`Performance.getMetrics` |
| `.impeccable/review/perf-desktop.json` | 开发服务器（Vite 未打包形态）对照 |
| `.impeccable/review/responsive.json` | 12 个视口的溢出/裁切/触控/断点两侧布局 |
| `tools/probe-accname.mjs` | CDP `Accessibility.getPartialAXTree` 真实无障碍名 |
| `tools/probe-sheet-ax.mjs` | 标本页 AX 名 + 真实 Tab 焦点落点 |
| `tools/probe-modelmatch.mjs` | `modelMatches()` 9 组真实模型名判定 |
| `tools/probe-sanitize.mjs` | `sanitizeSvg()` / `prepareSvgForImg()` 注入串处理 |
| `tools/probe-colorscheme.js` | `color-scheme` / `appearance` / `caret-color` / 滚动条 |
| `tools/check-i18n.mjs` | 143 键完整性、死键、英中长度比 |
| `tools/probe-live-render.mjs` | 流式生成时的长任务、帧间隔、DOM 变更、SSE 帧粒度 |
