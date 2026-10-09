import type { AppConfig, PromptEntry, ProviderProfile, RunEvent, RunRecord, RunRequest } from '@shared/types';

export interface PublicProvider extends ProviderProfile {
  hasKey: boolean;
}

export interface PublicConfig extends Omit<AppConfig, 'providers'> {
  providers: PublicProvider[];
  paths: { projectRoot: string; config: string; prompts: string; data: string };
}

export interface RecordDetail {
  record: RunRecord;
  svg: string | null;
  raw: string | null;
  reasoning: string | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* 忽略 */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const api = {
  getConfig: () => fetch('/api/config').then(json<PublicConfig>),

  saveConfig: (patch: Partial<AppConfig>) =>
    fetch('/api/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(json<PublicConfig>),

  addProvider: (body: Partial<ProviderProfile> & { apiKey?: string }) =>
    fetch('/api/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<PublicProvider>),

  updateProvider: (id: string, body: Partial<ProviderProfile> & { apiKey?: string }) =>
    fetch(`/api/providers/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<PublicProvider>),

  deleteProvider: (id: string) =>
    fetch(`/api/providers/${id}`, { method: 'DELETE' }).then(json<{ ok: boolean }>),

  getPrompts: () =>
    fetch('/api/prompts').then(
      json<{ pool: unknown; entries: PromptEntry[]; promptsPath: string; lang: 'zh' | 'en' }>,
    ),

  getRecords: () =>
    fetch('/api/records').then(
      json<{ records: RunRecord[]; stats: { total: number; byProvider: Record<string, number> } }>,
    ),

  getRecord: (id: string) => fetch(`/api/records/${id}`).then(json<RecordDetail>),

  patchRecordFlags: (id: string, flags: RunRecord['flags']) =>
    fetch(`/api/records/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ flags }),
    }).then(json<RunRecord>),

  deleteRecord: (id: string) =>
    fetch(`/api/records/${id}`, { method: 'DELETE' }).then(json<{ ok: boolean }>),
};

/** 发起一次生成，用回调消费 SSE 事件；返回中止函数。
 *
 *  `messages` 只装两句「给操作员看的话」，由调用方按当前语言传入 ——
 *  api 层不持有任何面向用户的文案，i18n 是调用方的事。 */
export function runStream(
  body: RunRequest,
  onEvent: (evt: RunEvent) => void,
  onError: (message: string) => void,
  messages: { network: string; interrupted: string } = {
    network: 'Failed to fetch',
    interrupted: 'The stream ended before the run reported a result.',
  },
): () => void {
  const controller = new AbortController();
  // 这一趟有没有结论。服务进程被杀、连接掉线都会让流「正常地」结束，
  // 而流里一个 done / error 都没有 —— 不补一句话，界面就永远停在「运行中」。
  let settled = false;
  let aborted = false;

  (async () => {
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let message = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) message = j.error;
        } catch {
          /* 忽略 */
        }
        onError(message);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).replace(/\r$/, '');
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload) as RunEvent;
            if (evt.type === 'done' || evt.type === 'error') settled = true;
            onEvent(evt);
          } catch {
            /* 跳过坏帧 */
          }
        }
      }

      if (!settled && !aborted) onError(messages.interrupted);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      // 离线 / 连接被拒时 fetch 只抛一句 "Failed to fetch"，那是给开发者看的。
      onError(
        err instanceof TypeError ? messages.network : err instanceof Error ? err.message : String(err),
      );
    }
  })();

  return () => {
    aborted = true;
    controller.abort();
  };
}
