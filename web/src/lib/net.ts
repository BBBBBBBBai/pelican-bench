/**
 * 网络层：同源代理路由 + CORS 失败的分因诊断。
 *
 * 这一整块是纯前端才有的东西，桌面版没有任何对应物。它有两个职责：
 *
 *   1. **代理路由**：官方 api.openai.com / api.anthropic.com 不允许浏览器直连
 *      （实测：POST 带 authorization 时预检被拒，换 origin 也一样）。部署在 Vercel 上时
 *      `vercel.json` 里两条 rewrite 把 `/api-proxy/{openai,anthropic}/*` 转到上游，
 *      于是这些请求变成**同源**请求，浏览器根本不发预检。只有这两家能这么走 ——
 *      rewrite 的目标是写死的，没法拿用户的任意 baseUrl 当上游。
 *
 *   2. **分因报错**：CORS 失败和「根本连不上」在 `fetch` 眼里是同一个
 *      `TypeError: Failed to fetch`。用户看到这一句没法判断该换站点还是该查网络。
 *      补一次 `mode:'no-cors'` 探测就能分开：服务器活着 → resolve 成 opaque 响应；
 *      域名解析失败/端口不通 → 仍然 throw。（这一条是探针实测过的，见 check5.js。）
 */

export type ProxyRoute = '/api-proxy/openai' | '/api-proxy/anthropic';

/** 浏览器直连不通、必须走同源代理的两家官方站 */
const PROXIED_HOSTS: Record<string, ProxyRoute> = {
  'api.openai.com': '/api-proxy/openai',
  'api.anthropic.com': '/api-proxy/anthropic',
};

function parseUrl(raw: string): URL | null {
  try {
    return new URL(String(raw ?? '').trim());
  } catch {
    return null;
  }
}

/** 这个地址能不能整个交给适配器去打。空串、`api.example.com`（少了协议）都要挡住。 */
export function isHttpUrl(raw: string): boolean {
  const url = parseUrl(raw);
  return Boolean(url && (url.protocol === 'http:' || url.protocol === 'https:'));
}

export function hostOf(raw: string): string {
  return parseUrl(raw)?.host ?? String(raw ?? '');
}

/** 该地址是否属于那两家必须代理的官方站 */
export function proxyRouteFor(baseUrl: string): ProxyRoute | null {
  const url = parseUrl(baseUrl);
  if (!url) return null;
  return PROXIED_HOSTS[url.hostname.toLowerCase()] ?? null;
}

/**
 * 没显式设置过「经本站代理」时用哪个默认值。
 *
 * 官方站直连必然失败，所以对它们默认打开代理；其余站点一律直连。
 * 关掉它当然可以（换个能直连的中转站就行），只是那对自己填的地址没有意义。
 */
export function defaultViaProxy(baseUrl: string): boolean {
  return proxyRouteFor(baseUrl) !== null;
}

/**
 * 把 baseUrl 换成本站代理下的相对路径。
 *
 * 只换 origin，保留 pathname —— 有人会把 `https://api.openai.com/v1` 整个填进
 * baseUrl（适配器还会再拼一次 /v1，那是他一贯的填法，不在这里纠正）。
 */
export function applyProxy(baseUrl: string, viaProxy: boolean | undefined): string {
  if (!viaProxy) return baseUrl;
  const route = proxyRouteFor(baseUrl);
  if (!route) return baseUrl;
  const url = parseUrl(baseUrl);
  if (!url) return baseUrl;
  return `${route}${url.pathname.replace(/\/+$/, '')}`;
}

/** 这次请求是不是走了代理（出错时要据此换一套说法） */
export function isProxied(baseUrl: string, requestBaseUrl: string): boolean {
  return baseUrl !== requestBaseUrl && requestBaseUrl.startsWith('/api-proxy/');
}

/**
 * 分清「服务器活着但没给 CORS 头」和「根本连不上」。
 *
 * 只在失败路径上调用 —— 成功的那条路上一次请求都不多发。
 */
export async function classifyFetchError(baseUrl: string): Promise<string> {
  const target = String(baseUrl ?? '').trim();
  if (!isHttpUrl(target)) return `地址「${target}」不是有效的 http(s) 地址`;

  const host = hostOf(target);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    // no-cors 只要求「能发出这个请求」。服务器活着就 resolve 成一个不透明响应
    // （status 恒为 0、读不出任何内容 —— 我们本来也不需要内容）。
    await fetch(target, { mode: 'no-cors', method: 'GET', signal: controller.signal, cache: 'no-store' });
    return `${host} 能连上，但没有返回浏览器需要的 CORS 允许头，所以本页读不到它的响应。换一个 CORS 友好的站点，或者改用本站代理（仅官方 [OI] / Anthropic 有代理）。`;
  } catch {
    return `连不上 ${host}（域名解析失败 / 端口不通 / 网络被阻断）。`;
  } finally {
    clearTimeout(timer);
  }
}
