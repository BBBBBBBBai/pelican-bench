import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RunEvent, RunRecord, RunRequest } from '@shared/types';
import { api, runStream, type PublicConfig, type RecordDetail } from './api';
import { makeT, type Lang } from './i18n';
import { BusBar } from './components/BusBar';
import { Rack } from './components/Rack';
import { ControlPanel } from './components/ControlPanel';
import { SpecimenSheet } from './components/SpecimenSheet';
import { reduceEvents } from './components/LiveBay';
import { rackOf } from './components/bits';

export default function App() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  // `detail` 为 null = 网络层失败，界面只印那颗人话；非 null = 可诊断的原文。
  const [bootFailed, setBootFailed] = useState<{ detail: string | null } | null>(null);
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null);

  const stopRef = useRef<(() => void) | null>(null);
  const toastTimer = useRef<number | null>(null);

  const lang: Lang = config?.uiLang ?? 'zh';
  const t = useMemo(() => makeT(lang), [lang]);
  const live = useMemo(() => reduceEvents(events), [events]);

  const showToast = useCallback((msg: string, err = false) => {
    setToast({ msg, err });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // fetch 在网络层失败时抛的是给开发者看的「Failed to fetch」——后端没起来时它必然出现，
  // 而那正是 `npm run dev` 最常见的首次状态。运行流里同一个故障已经有一句人话
  // （`run.networkFailed`），这里沿用同一句：同一件事不该在三个地方有三种说法。
  // 其余错误（HTTP 500、JSON 解析失败）保留原文 —— 那才是能拿去查的东西。
  // 只给「点了按钮之后才发生」的失败用（toast）。启动读取不用它，理由见下面 `boot`。
  const errText = useCallback(
    (err: unknown): string =>
      err instanceof TypeError ? t('run.networkFailed') : err instanceof Error ? err.message : String(err),
    [t],
  );

  const reloadConfig = useCallback(async () => {
    const cfg = await api.getConfig();
    setConfig(cfg);
    setSelectedId((prev) => (prev && cfg.providers.some((p) => p.id === prev) ? prev : (cfg.providers[0]?.id ?? null)));
  }, []);

  const reloadRecords = useCallback(async () => {
    const res = await api.getRecords();
    setRecords(res.records);
  }, []);

  // 启动读取抽成一颗可重入的函数，因为「服务还没起来」不是终局：
  // `npm run dev` 里前端和后台是两个进程同时在起，Vite 先就绪是常态，
  // 所以第一次读失败很正常。原来这条错误是一堵死墙 —— 页面上没有第二颗按钮，
  // 唯一的出路是自己想起来刷新。现在它旁边就有一颗「重试」。
  //
  // 这里**只存原文，不在这里翻译**。翻译要 `t`，而 `t` 跟着 `lang` 变 ——
  // 一旦把 `t` 写进依赖，切一次语言就会重跑这颗启动读取：白读一遍配置和名册，
  // 而且万一那一下后端答不上来，整个界面会被推进「启动失败」那一屏。
  // 所以网络层失败记 `detail: null`，由渲染处决定说哪句；语言变了只是换个说法。
  const boot = useCallback(async () => {
    try {
      await reloadConfig();
      await reloadRecords();
      setBootFailed(null);
    } catch (err) {
      setBootFailed({
        detail: err instanceof TypeError ? null : err instanceof Error ? err.message : String(err),
      });
    }
  }, [reloadConfig, reloadRecords]);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const onRun = useCallback(
    (req: RunRequest) => {
      setEvents([]);
      setTrackedId(null);
      setRunning(true);

      stopRef.current = runStream(
        req,
        (evt) => {
          setEvents((prev) => [...prev, evt]);
          if (evt.type === 'done') {
            // 先把新记录取回来，再熄掉通电那一格——顺序反了会闪一下空白。
            // 但取不回来也必须熄：一次成功的生成之后如果名册刷新失败，
            // 原来那条链会断在 .then 里，界面就永远停在「运行中」。
            void reloadRecords()
              .catch(() => undefined)
              .then(() => {
                setTrackedId(evt.record.id);
                setRunning(false);
              });
          } else if (evt.type === 'error') {
            showToast(evt.message, true);
            setRunning(false);
          }
        },
        (msg) => {
          showToast(msg, true);
          setRunning(false);
        },
        { network: t('run.networkFailed'), interrupted: t('run.streamBroken') },
      );
    },
    [reloadRecords, showToast, t],
  );

  const onStop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setRunning(false);
    // 中止也会落盘一条记录，取回来让那一格出现在机架上
    window.setTimeout(() => void reloadRecords().catch(() => undefined), 320);
  }, [reloadRecords]);

  // 面板改完配置后要重新读一遍。读失败原来是一颗未处理的 rejection：
  // 配置其实已经存进去了，界面却停在旧值上，而且一句话都没有。
  const onConfigChanged = useCallback(() => {
    void reloadConfig().catch((err: unknown) => showToast(errText(err), true));
  }, [errText, reloadConfig, showToast]);

  const openRecord = useCallback((id: string) => {
    setDetail(null);
    setDetailLoading(true);
    void api
      .getRecord(id)
      .then(setDetail)
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : String(err), true))
      .finally(() => setDetailLoading(false));
  }, [showToast]);

  const onRenderFailed = useCallback(
    (id: string, reason: string) => {
      const rec = records.find((r) => r.id === id);
      if (!rec || rec.flags.some((f) => f.code === 'render-failed')) return;
      void api
        .patchRecordFlags(id, [...rec.flags, { code: 'render-failed', detail: reason }])
        .then(() => reloadRecords())
        .catch(() => undefined);
    },
    [records, reloadRecords],
  );

  // 只剩「真的删」这一件事：确认已经由标本页那颗两段式按钮自己完成了
  // （第一段扣闩，第二段才调到这里），所以这里不再问第二遍。
  // 面板负责在退场动画播完之后才调这个函数，删完刷新名册。
  const onDelete = useCallback(
    (id: string): void => {
      void api
        .deleteRecord(id)
        .then(() => reloadRecords())
        .then(() => showToast(t('run.deleted')))
        .catch((err: unknown) => showToast(err instanceof Error ? err.message : String(err), true));
    },
    [reloadRecords, showToast, t],
  );

  if (bootFailed) {
    return (
      <div className="empty" style={{ paddingTop: 120 }}>
        <span className="silk silk-note">
          {bootFailed.detail === null ? t('app.initFailed') : t('app.bootFailed')}
        </span>
        {bootFailed.detail !== null && (
          <span className="read" style={{ color: 'var(--fault)' }}>
            {bootFailed.detail}
          </span>
        )}
        <button
          type="button"
          className="btn"
          style={{ marginTop: 14 }}
          onClick={() => {
            setBootFailed(null);
            void boot();
          }}
        >
          {t('app.retry')}
        </button>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="empty" style={{ paddingTop: 120 }}>
        <span className="silk silk-note">{t('app.loading')}</span>
      </div>
    );
  }

  const racks = new Set(records.map(rackOf)).size;

  return (
    <div className="bench">
      {/* 三块东西的 DOM 顺序就是窄屏上的阅读顺序与 Tab 顺序：
          总线条 → 控制台 → 机架。**手机上控制台排在机架前面** —— 一整面机架
          有四千多像素，把「开始生成」摆在它后面等于要滑五屏才够得着。
          宽屏上网格把控制台放回右列、机架留在左列，屏幕上看到的还是原来那一台。 */}
      <BusBar
        t={t}
        lang={lang}
        racks={racks}
        channels={records.length}
        running={running}
        live={live}
        tracked={records.find((r) => r.id === trackedId) ?? null}
        onLang={(l) => {
          // 原来是「乐观切换 + 静默吞掉失败」：界面立刻变成 EN，存盘却失败了，
          // 下一次刷新又自己跳回中文 —— 而且全程没有一句话。
          // 现在失败就退回原值并出声：宁可看到「没切成」，也不要看到「切了又自己变回去」。
          const prev = config.uiLang;
          setConfig({ ...config, uiLang: l });
          void api.saveConfig({ uiLang: l }).catch((err: unknown) => {
            setConfig({ ...config, uiLang: prev });
            showToast(errText(err), true);
          });
        }}
      />

      <ControlPanel
        config={config}
        t={t}
        running={running}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onConfigChanged={onConfigChanged}
        onRun={onRun}
        onStop={onStop}
        onToast={showToast}
      />

      <div className="bay">
        <Rack
          records={records}
          t={t}
          trackedId={trackedId}
          running={running}
          live={live}
          onStop={onStop}
          onOpen={openRecord}
          onRenderFailed={onRenderFailed}
        />
      </div>

      {detailLoading && !detail && (
        <div className="toast">
          <span className="read">{t('app.loading')}</span>
        </div>
      )}

      {detail && (
        <SpecimenSheet
          detail={detail}
          t={t}
          lang={lang}
          onClose={() => setDetail(null)}
          onDelete={onDelete}
          onRenderFailed={onRenderFailed}
        />
      )}

      {toast && <div className={`toast${toast.err ? ' error' : ''}`}>{toast.msg}</div>}
    </div>
  );
}
