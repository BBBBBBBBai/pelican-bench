/**
 * 全部界面文案。
 *
 * 硬约束：组件里禁止出现硬编码的中文（或英文）界面文案，一律走 `t('key')`。
 * 服务端写进 flag.detail 的诊断字符串属于数据，不在此列。
 *
 * 用词约定（改文案时请对照，别让同一件事有两个名字）：
 *   一次运行 = 一条记录；按天分组，天就是「日期」；记录的永久编号 = 「第 N 条」。
 *   供应商 = 一个接口地址 + 密钥的组合（旧称「档案」）。**模型名不在供应商里** ——
 *   它是每一次运行现场选的，因为「同一个模型名在不同供应商名下表现如何」正是这个
 *   工具要问的问题；把模型名存进档案，就等于让每家自带一个不同的被测量。
 *   异常 = 挂上任意标签的这条记录（旧称「标记」）；详情页 = 点开一条记录后的页面（旧称「标本页」）。
 *   量化读数（T= / MAX= / IN / OUT / TOT 等）保持原样，是数据不是文案。
 *   英文界面保留仪器编号写法（`R 2026-10-06 / CH 07`），中文界面写作 `2026-10-06 · 第 07 条`。
 */

export type Lang = 'zh' | 'en';

const dict = {
  // ── 铭牌 ────────────────────────────────────────────────────────────────
  'app.brandMark': { zh: 'PELICAN BENCH', en: 'PELICAN BENCH' },
  'app.tagline': { zh: '鹈鹕测试台 · 本机自用', en: 'local, single user' },
  'app.lang.zh': { zh: '中', en: '中' },
  'app.lang.en': { zh: 'EN', en: 'EN' },
  'app.loading': { zh: '读取中…', en: 'loading…' },
  'app.initFailed': { zh: '连不上本地服务，请确认后台进程还在运行。', en: 'cannot reach the local server — check that the backend is still running.' },
  // 上面那句说的是「进程不在」，可启动失败也可能是「进程在、但它答了个错」。
  // 那时再说「连不上」就是在误导人去看一个活着的进程 —— 所以两句分开，
  // 由下面那行原文说明真正的理由。
  'app.bootFailed': { zh: '启动时没能读完配置和记录。', en: 'could not finish reading the config and records at startup.' },
  'app.retry': { zh: '重试', en: 'RETRY' },

  // ── 顶栏读数 ────────────────────────────────────────────────────────────
  'bus.rack': { zh: '日期', en: 'DATES' },
  'bus.channel': { zh: '记录', en: 'RECORDS' },
  'bus.live': { zh: '运行中', en: 'RUNNING' },
  'bus.testing': { zh: '正在运行', en: 'RUNNING NOW' },
  'bus.onTest': { zh: '正在运行的这次请求', en: 'The run happening right now' },
  'bus.lastRun': { zh: '最近一次运行', en: 'The most recent run' },
  'bus.idle': { zh: '空闲', en: 'IDLE' },

  // ── 筛选栏 ──────────────────────────────────────────────────────────────
  'rail.profile': { zh: '供应商', en: 'PROVIDER' },
  'rail.prompt': { zh: '题目', en: 'PROMPT' },
  'rail.order': { zh: '排序', en: 'ORDER' },
  'rail.cell': { zh: '格子大小', en: 'CELL SIZE' },
  'rail.all': { zh: '全部', en: 'ALL' },
  'rail.anyPrompt': { zh: '全部题目', en: 'ALL PROMPTS' },
  /* 状态三档。选项文字只留两个汉字：这一排的另外四组都带一个可见标签，
     语义由标签承担；这一组没有标签，于是原来只能把整句话塞进选项里。
     长句子没丢，退到 title 上（rail.onlyIssues / rail.cleanHint）。 */
  'rail.status': { zh: '状态', en: 'STATUS' },
  'rail.issues': { zh: '异常', en: 'ISSUES' },
  'rail.clean': { zh: '正常', en: 'CLEAN' },
  'rail.onlyIssues': { zh: '只看有异常的', en: 'issues only' },
  'rail.cleanHint': { zh: '只看无异常的', en: 'issue-free only' },
  'rail.new': { zh: '新的在前', en: 'NEWEST' },
  'rail.old': { zh: '旧的在前', en: 'OLDEST' },
  'rail.reset': { zh: '重置筛选', en: 'RESET' },
  'rail.dense': { zh: '小', en: 'SMALL' },
  'rail.mid': { zh: '中', en: 'MEDIUM' },
  'rail.wide': { zh: '大', en: 'LARGE' },
  'rail.shown': { zh: '显示 {n} / {total}', en: 'SHOWING {n} / {total}' },
  /* 窄屏横杆收成一行摘要时，点开全部筛选项的那颗键。它不开新东西——
     展开的就是同一排挡位，只是在这一档上先卷着。 */
  'rail.filters': { zh: '筛选', en: 'FILTERS' },

  // ── 日期分组 ────────────────────────────────────────────────────────────
  'rack.count': { zh: '{n} 条', en: '{n} records' },
  'rack.empty': { zh: '还没有任何记录', en: 'NO RECORDS YET' },
  'rack.emptyHint': {
    zh: '在右边选一个供应商，按「开始生成」。每跑一次，这里就多一条记录。',
    en: 'pick a provider on the right and press START RUN. every run adds one record here.',
  },
  'rack.noneMatch': { zh: '没有符合筛选的记录', en: 'NO RECORDS MATCH THIS FILTER' },

  // ── 记录格 ──────────────────────────────────────────────────────────────
  'ch.open': { zh: '打开 {animal} 的详情', en: 'open the details for {animal}' },
  'ch.broken': { zh: '图形无法显示', en: 'WILL NOT RENDER' },
  'ch.noSvg': { zh: '没有 SVG', en: 'NO SVG' },
  'ch.when': { zh: '这一次运行的日期与时刻', en: 'Date and time of this run' },

  // ── 记录编号（永久，不随筛选或排序变化）──────────────────────────────────
  'addr.rack': { zh: '{date}', en: 'R {date}' },
  'addr.channel': { zh: '第 {n} 条', en: 'CH {n}' },
  'addr.full': { zh: '{date} · 第 {n} 条', en: 'R {date} / CH {n}' },

  // ── 正在运行的那一格 ────────────────────────────────────────────────────
  'live.title': { zh: '运行中', en: 'RUNNING' },
  'live.waiting': { zh: '正在等待模型返回…', en: 'waiting for the model to respond…' },
  'live.reasoning': { zh: '思考过程', en: 'REASONING' },
  'live.output': { zh: '模型输出', en: 'OUTPUT' },
  'live.attempt': { zh: '第 {n} 次尝试', en: 'ATTEMPT {n}' },
  'live.retrying': { zh: '等待后重试 · {reason}', en: 'RETRYING AFTER A WAIT · {reason}' },
  'live.noProfile': { zh: '先在右边选择一个供应商', en: 'PICK A PROVIDER ON THE RIGHT FIRST' },
  'live.follow': { zh: '自动滚动', en: 'FOLLOW' },

  // ── 控制面板：供应商 ────────────────────────────────────────────────────
  'ctrl.profiles': { zh: '供应商', en: 'PROVIDERS' },
  'ctrl.none': { zh: '还没有供应商', en: 'NO PROVIDERS YET' },
  'ctrl.add': { zh: '新建', en: 'NEW' },
  'ctrl.editProfile': { zh: '编辑供应商', en: 'EDIT PROVIDER' },
  'ctrl.save': { zh: '保存', en: 'SAVE' },
  'ctrl.cancel': { zh: '取消', en: 'CANCEL' },
  'ctrl.delete': { zh: '删除', en: 'DELETE' },
  'ctrl.deleteConfirm': { zh: '确认删除', en: 'CONFIRM DELETE' },
  'ctrl.name': { zh: '名称', en: 'NAME' },
  'ctrl.protocol': { zh: '协议', en: 'PROTOCOL' },
  'ctrl.baseUrl': { zh: '接口地址', en: 'BASE URL' },
  'ctrl.apiKey': { zh: 'API 密钥', en: 'API KEY' },
  'ctrl.apiKeyKeep': { zh: '留空则继续用已保存的密钥', en: 'leave blank to keep the saved key' },
  'ctrl.model': { zh: '模型名', en: 'MODEL' },
  'ctrl.temperature': { zh: '温度', en: 'TEMP' },
  'ctrl.maxTokens': { zh: '最大输出', en: 'MAX TOKENS' },
  // 供应商表单里「温度 / 最大输出」留空的意思。它是这一行唯一的解释，所以两句都要说全：
  // 留空不是「没填」，是「跟着全局默认走」—— 全局默认在 config.json 的 defaultParams 里。
  'ctrl.followGlobal': {
    zh: '留空 = 跟随全局默认（{value}）',
    en: 'blank = follow the global default ({value})',
  },
  // 思考强度。六档的名字就是发到线上的值，所以它们不进 i18n —— 那是数据不是文案，
  // 跟 OI / ANTH 一样照原样印。这里只给这一栏一个名字和一句解释。
  'ctrl.effort': { zh: '思考强度', en: 'THINKING EFFORT' },
  'ctrl.effortHint': {
    zh: '这一趟让模型想多久。实测六档之间总输出相差约 45%，而正文长度几乎不变 —— 它买的是思考，不是更长的答案。',
    en: 'how long the model may think. measured across the six levels: total output moves ~45% while the answer itself barely changes — it buys thinking, not a longer answer.',
  },
  'ctrl.noKey': { zh: '缺少密钥', en: 'NO KEY' },
  'ctrl.needFields': { zh: '接口地址必须填写', en: 'a base url is required' },

  // ── 控制面板：本次运行 ──────────────────────────────────────────────────
  'ctrl.runTitle': { zh: '本次运行', en: 'THIS RUN' },
  'ctrl.override': { zh: '参数单独设置', en: 'PARAMS FOR THIS RUN' },
  'ctrl.overrideHint': {
    zh: '只影响这一次运行；改动过的值会记在这条结果里。',
    en: 'this run only; overridden values are recorded in the result.',
  },
  'ctrl.modelPick': { zh: '要测哪个模型', en: 'MODEL UNDER TEST' },
  'ctrl.modelHint': {
    zh: '先定一个模型名，再按「开始生成」。同一家供应商可以反复换模型名测。',
    en: 'pick a model name, then press START RUN. the same provider can be tested with a different model name each time.',
  },
  // 空态这句要和门禁讲同一件事：没有候选**不等于**没得测 —— 手打的模型名照样发得出去。
  // 原来那句「没有匹配的模型名」配上仍然亮着的「开始生成」，是两句互相打脸的话。
  'ctrl.modelEmpty': {
    zh: '没有候选匹配 —— 仍会用你输入的名字',
    en: 'no candidate matches — the name you typed is still used',
  },
  'ctrl.modelClear': { zh: '清除已选模型名', en: 'CLEAR THE SELECTED MODEL NAME' },
  'ctrl.modelCandidates': { zh: '{n} 个候选', en: '{n} CANDIDATES' },
  'ctrl.tempOverride': { zh: '温度（本次）', en: 'TEMP' },
  'ctrl.maxOverride': { zh: '最大输出（本次）', en: 'MAX TOKENS' },
  'run.start': { zh: '开始生成', en: 'START RUN' },
  'run.needModel': { zh: '先选定模型名才能开始生成', en: 'PICK A MODEL NAME FIRST' },
  'run.needProfile': { zh: '先选一家供应商', en: 'PICK A PROVIDER FIRST' },
  'run.stop': { zh: '停止', en: 'STOP' },
  // 网络层的两句。原来这两种情况都会把浏览器/开发者的话直接甩到操作员脸上：
  // 离线时是 "Failed to fetch"，连接被掐断时则是一句话都没有 —— 界面永远停在「运行中」。
  'run.networkFailed': {
    zh: '连不上本地服务 —— 确认后端还在运行',
    en: 'cannot reach the local server — is the backend still up?',
  },
  'run.streamBroken': {
    zh: '连接中断，这一趟没有结果',
    en: 'connection dropped — this run has no result',
  },

  // ── 控制面板：全局设置 ──────────────────────────────────────────────────
  'ctrl.settings': { zh: '全局设置', en: 'SETTINGS' },
  'ctrl.promptLang': { zh: '题目语言', en: 'PROMPT LANG' },
  'ctrl.timeout': { zh: '超时（秒）', en: 'TIMEOUT (SEC)' },
  'ctrl.retries': { zh: '重试次数', en: 'RETRIES' },
  'ctrl.saveReasoning': { zh: '保存思考过程', en: 'KEEP REASONING' },
  'ctrl.saveRaw': { zh: '保存完整原始响应', en: 'KEEP RAW RESPONSE' },
  'ctrl.paths': { zh: '文件位置', en: 'ON DISK' },
  'ctrl.dataDir': { zh: '数据文件夹', en: 'DATA' },
  'ctrl.promptsFile': { zh: '题库文件', en: 'PROMPTS' },
  'ctrl.langZh': { zh: '中文题目', en: 'CHINESE' },
  'ctrl.langEn': { zh: '英文题目', en: 'ENGLISH' },
  'ctrl.modelPresets': { zh: '模型候选清单', en: 'MODEL CANDIDATES' },
  'ctrl.presetName': { zh: '候选 {n}', en: 'CANDIDATE {n}' },
  'ctrl.presetRemove': { zh: '删掉这一行', en: 'REMOVE THIS ROW' },
  'ctrl.presetAdd': { zh: '添加一行', en: 'ADD A ROW' },
  'ctrl.presetRestore': { zh: '恢复出厂清单', en: 'RESTORE DEFAULTS' },
  'ctrl.presetEmpty': { zh: '清单是空的。', en: 'the list is empty.' },

  // ── 详情页 ──────────────────────────────────────────────────────────────
  'sheet.facts': { zh: '运行数据', en: 'READOUT' },
  'sheet.prompt': { zh: '题目', en: 'PROMPT' },
  'sheet.error': { zh: '错误', en: 'ERROR' },
  'sheet.flags': { zh: '异常', en: 'ISSUES' },
  'sheet.svgSource': { zh: 'SVG 源码', en: 'SVG SOURCE' },
  'sheet.reasoning': { zh: '思考过程', en: 'REASONING' },
  'sheet.raw': { zh: '完整原始响应', en: 'RAW RESPONSE' },
  'sheet.copyPrompt': { zh: '复制题目', en: 'COPY PROMPT' },
  'sheet.copied': { zh: '已复制', en: 'COPIED' },
  'sheet.copySvg': { zh: '复制 SVG', en: 'COPY SVG' },
  'sheet.download': { zh: '下载 SVG', en: 'DOWNLOAD SVG' },
  'sheet.delete': { zh: '删除', en: 'DELETE' },
  'sheet.deleteArmed': { zh: '确认删除', en: 'CONFIRM DELETE' },
  'sheet.close': { zh: '关闭', en: 'CLOSE' },
  'sheet.deleteWarn': {
    zh: '这条记录的 SVG 和原始返回内容等文件会一起删除，无法恢复。',
    en: 'its SVG and raw response files go with it — no undo.',
  },
  'sheet.renderFailed': { zh: '这段 SVG 无法显示成图形', en: 'THIS SVG DOES NOT RENDER' },
  'sheet.noSvg': { zh: '这次没有生成 SVG', en: 'THIS RUN PRODUCED NO SVG' },
  'sheet.noSvgHint': { zh: '下面保留了模型返回的原始内容，可以自己看它到底返回了什么。', en: 'the raw output is below — read what it actually emitted.' },
  'sheet.rawNotSaved': {
    zh: '保存这条记录时没有开启「保存完整原始响应」，所以模型返回的原始内容没有被保存。',
    en: 'raw response was not kept for this record — the toggle was off when it was saved.',
  },
  'sheet.noFlags': { zh: '没有异常', en: 'NO ISSUES' },

  // ── 运行数据标签 ────────────────────────────────────────────────────────
  'meta.channel': { zh: '编号', en: 'NUMBER' },
  'meta.time': { zh: '时间', en: 'TIME' },
  'meta.duration': { zh: '耗时', en: 'DURATION' },
  'meta.attempts': { zh: '尝试', en: 'ATTEMPTS' },
  'meta.provider': { zh: '供应商', en: 'PROVIDER' },
  'meta.prompt': { zh: '题目', en: 'PROMPT' },
  'meta.requestedModel': { zh: '请求的模型名', en: 'REQ MODEL' },
  'meta.responseModel': { zh: '返回的模型名', en: 'RESP MODEL' },
  'meta.usage': { zh: '用量', en: 'USAGE' },
  'meta.finishReason': { zh: '结束原因', en: 'FINISH' },
  'meta.params': { zh: '参数', en: 'PARAMS' },
  'meta.protocol': { zh: '协议', en: 'PROTOCOL' },
  'meta.baseUrl': { zh: '接口地址', en: 'BASE URL' },
  'meta.overrides': { zh: '本次单独设置', en: 'OVERRIDES' },
  'meta.overridesYes': { zh: '是', en: 'YES' },
  'meta.overridesNo': { zh: '否', en: 'NO' },
  'meta.responseId': { zh: '响应 ID', en: 'RESPONSE ID' },
  'meta.rawLength': { zh: '输出字符数', en: 'CHARS' },

  // ── 运行时铭牌（格子 / 详情页，槽位窄，保持短）───────────────────────────
  'flag.render-failed': { zh: '渲染失败', en: 'RENDER FAILED' },
  'flag.not-svg': { zh: '没有 SVG', en: 'NOT SVG' },
  'flag.truncated': { zh: '输出截断', en: 'TRUNCATED' },
  'flag.model-mismatch': { zh: '模型名不一致', en: 'MODEL MISMATCH' },
  'flag.http-error': { zh: '请求失败', en: 'HTTP ERROR' },
  'flag.timeout': { zh: '超时', en: 'TIMEOUT' },
  'flag.aborted': { zh: '已中止', en: 'ABORTED' },

  // ── 其它 ────────────────────────────────────────────────────────────────
  'run.renderFailedByBrowser': {
    zh: '浏览器无法把这段 SVG 解析成图形',
    en: 'the browser cannot parse this SVG into a drawing',
  },
  'run.deleted': { zh: '已删除', en: 'DELETED' },
  'run.saved': { zh: '已保存', en: 'SAVED' },
} as const;

export type TKey = keyof typeof dict;

export function makeT(lang: Lang) {
  return (key: TKey, vars?: Record<string, string | number>): string => {
    const entry = dict[key];
    let out: string = entry ? entry[lang] : key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
    }
    return out;
  };
}

export type T = ReturnType<typeof makeT>;
