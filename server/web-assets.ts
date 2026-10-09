import fs from 'node:fs';
import path from 'node:path';
import { getAsset, getAssetKeys } from 'node:sea';
import type { Express } from 'express';
import { PACKAGED, PROJECT_ROOT } from './config.ts';

/**
 * 前端产物从哪来。
 *
 * 开发时读磁盘上的 `dist/web/`；打包后从 exe 内部读 —— sea-config.json 已经把整个
 * dist/web 挂成了 `web/…` 的 SEA 资源。两条读法不同，但对上层是同一对函数。
 */
const DEV_WEB_DIST = path.join(PROJECT_ROOT, 'dist', 'web');

/** 打包时资源 key 的前缀，和 build/sea-config.mjs 里保持一致。 */
const ASSET_PREFIX = 'web/';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/** 有没有前端可发。打包后看内嵌资源，开发时看 dist/web 目录。 */
export function hasWeb(): boolean {
  if (!PACKAGED) return fs.existsSync(path.join(DEV_WEB_DIST, 'index.html'));
  try {
    return getAssetKeys().includes(`${ASSET_PREFIX}index.html`);
  } catch {
    return false;
  }
}

/** 读一份前端文件。key 是相对 dist/web 的 posix 路径，例如 `assets/index-DpWdK1-b.js`。 */
export function readWebFile(key: string): Buffer | null {
  if (PACKAGED) {
    try {
      return Buffer.from(getAsset(`${ASSET_PREFIX}${key}`));
    } catch {
      return null; // 资源里没有这个 key
    }
  }
  const abs = path.resolve(DEV_WEB_DIST, key);
  // 路径穿越防护：解析后必须仍在 dist/web 里面
  if (abs !== DEV_WEB_DIST && !abs.startsWith(DEV_WEB_DIST + path.sep)) return null;
  try {
    if (!fs.statSync(abs).isFile()) return null;
    return fs.readFileSync(abs);
  } catch {
    return null;
  }
}

/**
 * 把前端挂到所有非 `/api/` 的路由上。
 *
 * 只注册一个通配处理函数，而不是 `express.static` 加一个兜底：打包后资源在内存里，
 * `express.static` 只认磁盘，多一套分支就多一处能走岔的地方。开发模式下多走一层
 * `fs.readFileSync` 的代价可以忽略。
 *
 * 调用方要先问过 `hasWeb()` —— 没构建过前端时不该注册这个通配，否则请求会拿到
 * 一页「前端产物缺失」而不是 Express 本来的 404。
 */
export function attachWeb(app: Express): void {
  app.get(/^(?!\/api\/).*/, (req, res) => {
    let key = decodeURIComponent(req.path).replace(/^\/+/, '');
    if (!key || key.endsWith('/')) key += 'index.html';

    // SPA 兜底：认不出的路径交给前端路由，而不是甩一个 404
    const buf = key.includes('..') ? null : readWebFile(key);
    const file = buf ?? readWebFile('index.html');
    const name = buf ? key : 'index.html';

    if (!file) {
      res.status(404).type('text/plain').send('前端产物缺失：先跑一次 npm run build');
      return;
    }
    res.setHeader('Content-Type', MIME[path.extname(name).toLowerCase()] ?? 'application/octet-stream');
    // Vite 给 assets/ 下的文件名带了内容哈希，可以永久缓存；index.html 必须每次问
    res.setHeader(
      'Cache-Control',
      name.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
    res.send(file);
  });
}
