(async () => {
  const out = {};
  const realFetch = window.fetch;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Vite 直接按源码路径伺服 TS 模块，所以在页面里可以拿到真的 runStream 去测
  let mod;
  try {
    mod = await import('/src/api.ts');
  } catch (e) {
    return { importFailed: String(e) };
  }
  out.exported = typeof mod.runStream;

  const MSG = { network: 'NET-MARKER', interrupted: 'BROKEN-MARKER' };
  const body = { providerId: 'p_x', model: 'm' };

  // A) 流「正常」结束但一个 done/error 都没有 —— 后端进程被杀就是这样
  window.fetch = async () =>
    new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: {"type":"start"}\n'));
          c.close();
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );

  out.broken = await new Promise((resolve) => {
    const seen = [];
    const timer = setTimeout(() => resolve({ timedOut: true, seen }), 2000);
    mod.runStream(body, (e) => seen.push(e.type), (m) => {
      clearTimeout(timer);
      resolve({ seen, error: m });
    }, MSG);
  });

  // B) 网络层直接抛 TypeError —— 离线、连接被拒
  window.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  out.network = await new Promise((resolve) => {
    const seen = [];
    const timer = setTimeout(() => resolve({ timedOut: true, seen }), 2000);
    mod.runStream(body, (e) => seen.push(e.type), (m) => {
      clearTimeout(timer);
      resolve({ seen, error: m });
    }, MSG);
  });

  // C) 用户自己按停止 —— 不该冒出任何错误
  window.fetch = async () =>
    new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: {"type":"start"}\n'));
          // 不收口：模拟一个长连接，等调用方 abort
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );

  out.abort = await new Promise((resolve) => {
    const seen = [];
    let errored = null;
    const stop = mod.runStream(body, (e) => seen.push(e.type), (m) => {
      errored = m;
    }, MSG);
    setTimeout(() => stop(), 120);
    setTimeout(() => resolve({ seen, error: errored }), 900);
  });

  // D) 正常的 done —— 不该有第二句话
  window.fetch = async () =>
    new Response(
      new ReadableStream({
        start(c) {
          const enc = new TextEncoder();
          c.enqueue(enc.encode('data: {"type":"start"}\n'));
          c.enqueue(enc.encode('data: {"type":"done","record":{"id":"x"}}\n'));
          c.close();
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );

  out.done = await new Promise((resolve) => {
    const seen = [];
    let errored = null;
    mod.runStream(body, (e) => seen.push(e.type), (m) => {
      errored = m;
    }, MSG);
    setTimeout(() => resolve({ seen, error: errored }), 600);
  });

  window.fetch = realFetch;
  await sleep(30);
  out.restored = window.fetch === realFetch;
  return out;
})()
