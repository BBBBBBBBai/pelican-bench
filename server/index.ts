import { spawn } from 'node:child_process';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { AppConfig, EffortLevel, GenParams, ProviderProfile, RunRequest } from '../shared/types.ts';
import { DEFAULT_PARAMS, EFFORT_LEVELS } from '../shared/types.ts';
import {
  deleteApiKey,
  getConfigPath,
  getPromptsPath,
  hasApiKey,
  PACKAGED,
  PROJECT_ROOT,
  readConfig,
  resolveDataDir,
  setApiKey,
  USER_ROOT,
  writeConfig,
} from './config.ts';
import { listPrompts, readPromptPool } from './prompts.ts';
import { RunError, startRun } from './runner.ts';
import { prepareSvgForImg } from '../shared/svg.ts';
import { deleteRecord, getRecord, listRecords, patchRecord, readSideFile, stats } from './storage.ts';
import { attachWeb, hasWeb } from './web-assets.ts';

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT ?? 8787);

// ---------------------------------------------------------------- 配置

/** 不把 key 发给前端，只回「有没有」 */
function publicConfig(cfg: AppConfig) {
  return {
    ...cfg,
    providers: cfg.providers.map((p) => ({ ...p, hasKey: hasApiKey(p.id) })),
    paths: {
      projectRoot: PROJECT_ROOT,
      config: getConfigPath(),
      prompts: getPromptsPath(),
      data: resolveDataDir(cfg),
    },
  };
}

app.get('/api/config', (_req, res) => {
  res.json(publicConfig(readConfig()));
});

/** 候选名一行的长度上限。超过它的东西不是「模型名」，是有人把别处的一整段粘了进来。
 *  砍到上限而不是整行丢掉：丢掉读起来是「我粘的东西凭空消失了」。 */
const MAX_PRESET_LEN = 120;
/** 候选清单的行数上限。这张表是给手用的快捷键，不是数据表。 */
const MAX_PRESETS = 200;

/** 候选清单的清洗。数组是整体替换的（不是 defaultParams 那种浅合并）：
 *  用户在全局设置里把某一行删掉，删掉就得算数，不能和旧值并起来。 */
function sanitizePresets(raw: unknown[]): string[] {
  const out: string[] = [];
  for (const item of raw) {
    const name = typeof item === 'string' ? item.trim().slice(0, MAX_PRESET_LEN) : '';
    if (name && !out.includes(name)) out.push(name);
    if (out.length >= MAX_PRESETS) break;
  }
  return out;
}

/** 全局默认那一层：浅合并，但每个进来的值都要过一遍闸 —— 认不出的 effort
 *  会一直躺在 config.json 里，直到下一次读配置才被 coerceParams 修掉。 */
function sanitizeDefaultParams(raw: unknown, current: GenParams): GenParams {
  if (raw == null || typeof raw !== 'object') return current;
  const r = raw as Partial<GenParams>;
  const next: GenParams = { ...current };
  const temp = Number(r.temperature);
  if (r.temperature != null && Number.isFinite(temp)) next.temperature = temp;
  const max = Number(r.maxTokens);
  if (r.maxTokens != null && Number.isFinite(max)) next.maxTokens = Math.max(1, Math.floor(max));
  if (r.topP != null) {
    const topP = Number(r.topP);
    if (Number.isFinite(topP)) next.topP = topP;
  }
  if (r.effort !== undefined) {
    next.effort = EFFORT_LEVELS.includes(r.effort as EffortLevel) ? (r.effort as EffortLevel) : current.effort;
  }
  return next;
}

app.put('/api/config', (req, res) => {
  const incoming = req.body as Partial<AppConfig>;
  const current = readConfig();
  const next: AppConfig = {
    ...current,
    dataDir: typeof incoming.dataDir === 'string' && incoming.dataDir ? incoming.dataDir : current.dataDir,
    promptLang: incoming.promptLang === 'en' ? 'en' : 'zh',
    timeoutSec:
      typeof incoming.timeoutSec === 'number' && incoming.timeoutSec > 0
        ? Math.floor(incoming.timeoutSec)
        : current.timeoutSec,
    retries:
      typeof incoming.retries === 'number' && incoming.retries >= 0
        ? Math.floor(incoming.retries)
        : current.retries,
    defaultParams: sanitizeDefaultParams(incoming.defaultParams, current.defaultParams),
    uiLang: incoming.uiLang === 'en' ? 'en' : incoming.uiLang === 'zh' ? 'zh' : current.uiLang,
    saveReasoning:
      typeof incoming.saveReasoning === 'boolean' ? incoming.saveReasoning : current.saveReasoning,
    saveRawResponse:
      typeof incoming.saveRawResponse === 'boolean' ? incoming.saveRawResponse : current.saveRawResponse,
    modelPresets: Array.isArray(incoming.modelPresets)
      ? sanitizePresets(incoming.modelPresets)
      : current.modelPresets,
  };
  writeConfig(next);
  res.json(publicConfig(next));
});

// ---------------------------------------------------------------- 供应商

/** 档案名与接口地址的长度上限。这两个是外来字符串里跑得最远的两条：
 *  它们会进 config.json，再进右栏的字段、名册的槽位、机架回执，
 *  最后抄进每一条记录。没有底的话，一次误粘会跟着这份配置一直活下去。 */
const MAX_PROFILE_NAME = 80;
const MAX_BASE_URL = 500;

/** 供应商参数是「留空 = 跟随全局默认」，所以这里**不能**用 DEFAULT_PARAMS 兜底填满 ——
 *  填满了就又是一家压着全局的站。只收用户真写了的字段。 */
function sanitizeParams(raw: any): Partial<GenParams> {
  const out: Partial<GenParams> = {};
  if (raw == null || typeof raw !== 'object') return out;
  const temp = Number(raw.temperature);
  if (raw.temperature != null && Number.isFinite(temp)) out.temperature = temp;
  const max = Number(raw.maxTokens);
  if (raw.maxTokens != null && Number.isFinite(max)) out.maxTokens = Math.max(1, Math.floor(max));
  const topP = Number(raw.topP);
  if (raw.topP != null && Number.isFinite(topP)) out.topP = topP;
  if (raw.effort !== undefined) {
    out.effort = EFFORT_LEVELS.includes(raw.effort as EffortLevel) ? (raw.effort as EffortLevel) : DEFAULT_PARAMS.effort;
  }
  return out;
}

function sanitizeProfile(body: any, fallbackId?: string): ProviderProfile {
  return {
    id: typeof body.id === 'string' && body.id ? body.id : fallbackId ?? `p_${Math.random().toString(36).slice(2, 10)}`,
    name: String(body.name ?? '').trim().slice(0, MAX_PROFILE_NAME) || '未命名供应商',
    protocol: body.protocol === 'anthropic' ? 'anthropic' : 'openai',
    baseUrl: String(body.baseUrl ?? '').trim().slice(0, MAX_BASE_URL).replace(/\/+$/, ''),
    params: sanitizeParams(body.params),
    verified: Boolean(body.verified),
    createdAt: typeof body.createdAt === 'string' ? body.createdAt : new Date().toISOString(),
  };
}

app.get('/api/providers', (_req, res) => {
  const cfg = readConfig();
  res.json(cfg.providers.map((p) => ({ ...p, hasKey: hasApiKey(p.id) })));
});

app.post('/api/providers', (req, res) => {
  const cfg = readConfig();
  const profile = sanitizeProfile(req.body);
  if (!profile.baseUrl) {
    res.status(400).json({ error: '接口地址必填' });
    return;
  }
  cfg.providers.push(profile);
  writeConfig(cfg);
  const apiKey = typeof req.body.apiKey === 'string' ? req.body.apiKey : '';
  if (apiKey) setApiKey(profile.id, apiKey);
  res.status(201).json({ ...profile, hasKey: hasApiKey(profile.id) });
});

app.put('/api/providers/:id', (req, res) => {
  const cfg = readConfig();
  const idx = cfg.providers.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: '供应商不存在' });
    return;
  }
  const profile = sanitizeProfile({ ...req.body, id: req.params.id, createdAt: cfg.providers[idx].createdAt });
  cfg.providers[idx] = profile;
  writeConfig(cfg);
  if (typeof req.body.apiKey === 'string' && req.body.apiKey !== '') setApiKey(profile.id, req.body.apiKey);
  res.json({ ...profile, hasKey: hasApiKey(profile.id) });
});

app.delete('/api/providers/:id', (req, res) => {
  const cfg = readConfig();
  const before = cfg.providers.length;
  cfg.providers = cfg.providers.filter((p) => p.id !== req.params.id);
  if (cfg.providers.length === before) {
    res.status(404).json({ error: '供应商不存在' });
    return;
  }
  writeConfig(cfg);
  deleteApiKey(req.params.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- 题池

app.get('/api/prompts', (_req, res) => {
  const cfg = readConfig();
  res.json({
    pool: readPromptPool(),
    entries: listPrompts(cfg.promptLang),
    promptsPath: getPromptsPath(),
    lang: cfg.promptLang,
  });
});

// ---------------------------------------------------------------- 运行（SSE）

app.post('/api/run', (req, res) => {
  const body = req.body as RunRequest;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  let handle: ReturnType<typeof startRun>;
  try {
    handle = startRun(body);
  } catch (err) {
    const message = err instanceof RunError ? err.message : err instanceof Error ? err.message : String(err);
    send({ type: 'error', message });
    res.end();
    return;
  }

  // 注意：不能监听 req 的 close —— Express 读完请求体后 req 就会触发 close，
  // 会被误判成「客户端断开」。改监听 res，并用 finished 区分正常收尾。
  let finished = false;
  res.on('close', () => {
    if (!finished) handle.abort();
  });

  (async () => {
    try {
      for await (const evt of handle.events) {
        send(evt);
      }
    } catch (err) {
      send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      finished = true;
      res.end();
    }
  })();
});

// ---------------------------------------------------------------- 记录

app.get('/api/records', (_req, res) => {
  res.json({ records: listRecords(), stats: stats() });
});

app.get('/api/records/:id', (req, res) => {
  const record = getRecord(req.params.id);
  if (!record) {
    res.status(404).json({ error: '记录不存在' });
    return;
  }
  res.json({
    record,
    svg: readSideFile(record.svgPath),
    raw: readSideFile(record.rawPath),
    reasoning: readSideFile(record.reasoningPath),
  });
});

app.patch('/api/records/:id', (req, res) => {
  const record = getRecord(req.params.id);
  if (!record) {
    res.status(404).json({ error: '记录不存在' });
    return;
  }
  const flags = Array.isArray(req.body?.flags) ? req.body.flags : null;
  if (!flags) {
    res.status(400).json({ error: '需要 flags 字段' });
    return;
  }
  // 合并标签（按 code 去重）
  const merged = [...record.flags];
  for (const f of flags) {
    if (!f?.code) continue;
    const idx = merged.findIndex((m) => m.code === f.code);
    if (idx === -1) merged.push(f);
    else merged[idx] = f;
  }
  const next = patchRecord(record.id, { flags: merged });
  res.json(next);
});

/**
 * 缩略图/详情用图：直接返回 SVG 字节。
 * 前端用 <img src> 加载——不执行脚本，也不产生额外 JSON 解析开销。
 */
app.get('/api/records/:id/svg', (req, res) => {
  const record = getRecord(req.params.id);
  if (!record) {
    res.status(404).type('text/plain').send('记录不存在');
    return;
  }
  const svg = readSideFile(record.svgPath);
  if (!svg) {
    res.status(404).type('text/plain').send('这条记录没有可用的 SVG');
    return;
  }
  res.type('image/svg+xml');
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
  res.send(prepareSvgForImg(svg));
});

app.delete('/api/records/:id', (req, res) => {
  const ok = deleteRecord(req.params.id);
  if (!ok) {
    res.status(404).json({ error: '记录不存在' });
    return;
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------- 静态资源（生产构建）

// 前端产物：开发时读磁盘上的 dist/web，打包后读 exe 里内嵌的资源（见 server/web-assets.ts）。
// 没构建过前端就整段跳过 —— 让请求拿到 Express 本来的 404，而不是一页「产物缺失」。
if (hasWeb()) attachWeb(app);

// ---------------------------------------------------------------- 兜底

/**
 * 必须注册在所有路由之后。
 *
 * Express 默认的错误响应是**一页 HTML**，而前端（web/src/api.ts:19-31）只会去
 * `res.json()` 里读 `error` 字段 —— 读不到就退回一句「HTTP 500」。也就是说，
 * 一次超限的请求体和一次真的崩掉，在界面上长得一模一样，而且都不可读。
 * 这里把每一种失败翻成同一种形状：`{ error }`。
 */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: '请求体超过 2mb 上限' });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: '请求体不是合法的 JSON' });
    return;
  }
  const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
});

/**
 * 从起始端口往上找一个能 listen 的端口。
 *
 * 8787 被占（又开了一份 exe、或者别的程序占着）不该让整个程序弹栈崩掉。对一个
 * 「双击就能用」的工具来说，崩掉的代价远远大于端口号多一位。往上找 20 个够用了。
 */
function listenWithFallback(port: number, tries = 20): Promise<number> {
  return new Promise((resolve, reject) => {
    const attempt = (p: number, left: number): void => {
      const srv = app.listen(p, '127.0.0.1');
      srv.once('listening', () => resolve(p));
      srv.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && left > 0) {
          attempt(p + 1, left - 1);
          return;
        }
        reject(err);
      });
    };
    attempt(port, tries);
  });
}

/** 开系统默认浏览器。打不开就算了 —— 地址已经印在控制台上了。 */
function openBrowser(url: string): void {
  const win = process.platform === 'win32';
  const cmd = win ? process.env.ComSpec || 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  // Windows 的 start 会把第一个带引号的参数当成窗口标题，所以那个空串不能省。
  const args = win ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    /* 忽略：印在控制台上的地址仍然是可点的 */
  }
}

listenWithFallback(PORT)
  .then((port) => {
    const cfg = readConfig();
    const url = `http://127.0.0.1:${port}`;
    console.log(`[server] 已启动：${url}${port === PORT ? '' : `（${PORT} 被占用，往上换了一位）`}`);
    console.log(`[server] 配置文件：${getConfigPath()}`);
    console.log(`[server] 题池文件：${getPromptsPath()}`);
    console.log(`[server] 数据目录：${resolveDataDir(cfg)}`);
    if (!cfg.providers.length) {
      console.log('[server] 还没有供应商档案，请在界面右侧添加。');
    }
    console.log('[server] 关掉这个窗口就是退出。');
    // 开发模式（npm run dev）下前端在 Vite 那边跑，别把浏览器抢到 8787 来。
    const wantOpen = PACKAGED ? process.env.PB_NO_OPEN !== '1' : process.env.PB_OPEN === '1';
    if (wantOpen && hasWeb()) openBrowser(url);
  })
  .catch((err: NodeJS.ErrnoException) => {
    console.error(`[server] 起不来：${err.code ?? ''} ${err.message}`.trim());
    // 两种失败长得完全不一样，别给一句放之四海而皆准的废话。
    if (err.code === 'EADDRINUSE') {
      console.error(`[server] 从 ${PORT} 一路往上试了 20 个端口都被占了 —— 先关掉已经开着的那一份。`);
    } else {
      console.error(`[server] 多半是数据目录写不进去：${USER_ROOT}`);
      console.error('[server] 检查那个目录的权限，或者删掉它让程序重建。');
    }
    process.exitCode = 1;
  });
