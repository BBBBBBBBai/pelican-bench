import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { RunRecord } from '@shared/types';
import { DEFAULT_CONFIG, writeConfig, writeKeys } from '../lib/config';
import { STORE_CONFIG, STORE_KEYS, STORE_RECORDS, STORE_SIDECARS, dbClearMany } from '../lib/idb';
import { startRun } from '../lib/runner';

/**
 * 拿**真 Key**、打**真中转站**、走完**整条流式管道**。
 *
 * 这是一条要花钱的测试，所以默认不跑 —— 必须显式：
 *
 *     $env:PB_REAL_RUN='1'; npx vitest run --config web/vitest.config.ts src/test
 *
 * 它验证的是搬迁里风险最高的那一段：配置 → 取 Key → 拼 URL → 发请求 → 逐块解析 SSE →
 * 收 usage / finish_reason → 判定标签。单测证明的是「代码按我以为的方式跑」，
 * 这条证明的是「中转站也认这套」—— CORS 那一层由浏览器负责，这里验证不到
 * （Node 的 fetch 没有同源策略），所以它不能替代浏览器里点一次。
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const KEYS_FILE = join(ROOT, 'config.local.json');

const ENABLED = process.env.PB_REAL_RUN === '1' && existsSync(KEYS_FILE);

function realKey(id: string): string {
  if (!ENABLED) return '';
  try {
    const keys = JSON.parse(readFileSync(KEYS_FILE, 'utf8')) as Record<string, string>;
    return keys[id] ?? '';
  } catch {
    return '';
  }
}

/**
 * 用户机器上跑过的三家（档案是从记录里反推出来的）。
 *
 * 默认挑 `p_d34xbpav`（banban-0.18）：探针实测它是目前唯一还在正常流式吐块的
 * —— a6 现在对任何请求都回 503「订阅池中没有可进入路由的活跃商家」，
 * banban-0.23 回 503 model_not_found。换一家的话：
 *
 *     $env:PB_REAL_PROVIDER='p_78j76c5s'
 */
const PROVIDERS: Record<string, { name: string; protocol: 'openai'; baseUrl: string }> = {
  p_d34xbpav: { name: 'banban-0.18', protocol: 'openai', baseUrl: 'https://api.banban.plus' },
  p_l3wid7ej: { name: 'banban-0.23', protocol: 'openai', baseUrl: 'https://api.banban.plus' },
  p_78j76c5s: { name: 'a6', protocol: 'openai', baseUrl: 'https://api.a6api.com' },
};

const TARGET_ID = process.env.PB_REAL_PROVIDER ?? 'p_d34xbpav';
const TARGET = { id: TARGET_ID, ...(PROVIDERS[TARGET_ID] ?? PROVIDERS.p_d34xbpav) };
const API_KEY = realKey(TARGET.id);

describe.skipIf(!ENABLED || !API_KEY)('真 Key · 真中转站 · 整条流式管道', () => {
  it('题目发出去、增量收回来、记录拼完整', async () => {
    await dbClearMany([STORE_CONFIG, STORE_KEYS, STORE_RECORDS, STORE_SIDECARS]);
    await writeConfig({
      ...DEFAULT_CONFIG,
      retries: 0, // 失败就失败，别把一次出错放大成三次计费
      timeoutSec: 180,
      providers: [
        {
          id: TARGET.id,
          name: TARGET.name,
          protocol: TARGET.protocol,
          baseUrl: TARGET.baseUrl,
          params: {},
          createdAt: new Date().toISOString(),
        },
      ],
    });
    await writeKeys({ [TARGET.id]: API_KEY });

    const handle = await startRun({
      providerId: TARGET.id,
      model: 'gpt-6.1-sol',
      // 注意形状：RunOverrides 是 { params?: Partial<GenParams> }，不是把 GenParams 摊平。
      // 摊平写的话 TypeScript 会报错，而运行时会被整个忽略 —— 那就变成「以为在用 low，其实在用默认的 high」。
      overrides: { params: { temperature: 1, maxTokens: 16000, effort: 'low' } },
    });

    const text: string[] = [];
    let reasoning = 0;
    let done: RunRecord | null = null;
    let failure: string | null = null;
    let chunks = 0;

    for await (const evt of handle.events) {
      if (evt.type === 'delta') {
        chunks += 1;
        text.push(evt.text);
      } else if (evt.type === 'reasoning') {
        reasoning += evt.text.length;
      } else if (evt.type === 'done') {
        done = evt.record;
      } else if (evt.type === 'error') {
        failure = evt.message;
      }
    }

    const body = text.join('');
    const codes = (done?.flags ?? []).map((f) => f.code);
    // 打出来是为了让人看一眼真实往返，而不是只看一句绿
    console.log(
      [
        '',
        `  供应商     ${TARGET.name} (${TARGET.baseUrl})`,
        `  结果       ${failure ?? (codes.includes('http-error') ? `失败：${done?.error}` : '成功')}`,
        `  增量块数   ${chunks}`,
        `  正文       ${body.length} 字符`,
        `  思考       ${reasoning} 字符`,
        `  实际模型   ${done?.responseModel ?? '—'}`,
        `  结束原因   ${done?.finishReason ?? '—'}`,
        `  标签       ${codes.join(' ') || '（干净）'}`,
        `  用量       ${done?.usage ? JSON.stringify(done.usage) : '—'}`,
        `  SVG        ${done?.hasSvg ? '抓到了' : '没抓到'}`,
        '',
      ].join('\n'),
    );

    expect(failure).toBeNull();
    expect(done).not.toBeNull();
    expect(body.length).toBeGreaterThan(0);
    // HTTP 层没出错 = 地址、鉴权头、body 形状都被这家站认了
    expect(codes).not.toContain('http-error');
    // 供应商回了模型名，说明解析走到了 choices[0]
    expect(done?.responseModel).toBeTruthy();
    // 回声模型名与请求一致 —— 中转站偷偷换模型正是这个工具要抓的东西
    expect(codes).not.toContain('model-mismatch');
  }, 300_000);
});
