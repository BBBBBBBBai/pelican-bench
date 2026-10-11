/**
 * IndexedDB 薄封装。
 *
 * 这是唯一碰 `indexedDB` 的地方，上面几层（config / records / zipcodec）只认
 * 「读一个对象 / 写一个对象 / 列一张表」。分成五个 store，理由和桌面版分文件一样：
 *
 *   config   一份设置 + 一份题池（键值表，两个 key）
 *   keys     API Key 单独一张表（密文，见 keyvault.ts）—— 「清空所有 Key」于是就是
 *            clear 一张表，不会误伤设置
 *   records  记录元数据（列表页只读这一张）
 *   sidecars svg / raw / reasoning 的正文，单独一张 —— 列表页永远不去拉它们
 *   meta     本机杂项：加密 Key 用的柜子密钥。导出/导入不碰这张表（换台机器就得重新
 *            生成一把，这是对的）
 *
 * 最后一条是照抄参考项目（gpt_image_playground 的 src/lib/db.ts）的做法：
 * 重的和轻的分表，列表才不会为了画一排卡片把几 MB 的正文全读进内存。
 */

export const DB_NAME = 'pelican-bench';
// 2：多了 meta 表（放加密 Key 用的柜子密钥）。老库升级和新库首建走同一条代码，
// 见下面 onupgradeneeded 里的逐个 contains 判断。
export const DB_VERSION = 2;

export const STORE_CONFIG = 'config';
export const STORE_KEYS = 'keys';
export const STORE_RECORDS = 'records';
export const STORE_SIDECARS = 'sidecars';
/** 本机的杂项：目前只有一行 `vault-key`（不可导出的 AES-GCM 密钥，见 keyvault.ts） */
export const STORE_META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

/** 一个页面只开一次库；开失败时清掉缓存，好让下一次点击能真的重试 */
export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      // 逐个 contains 判断，而不是只判断 oldVersion —— 这样以后加表
      // 只要把版本号 +1，老库和新库都走得通同一条代码。
      if (!db.objectStoreNames.contains(STORE_CONFIG)) {
        db.createObjectStore(STORE_CONFIG, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_KEYS)) {
        db.createObjectStore(STORE_KEYS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SIDECARS)) {
        db.createObjectStore(STORE_SIDECARS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      // 别的新标签页要用更新的版本打开这张库：主动让位，否则对方会一直卡在
      // request.onblocked（界面上就是「被另一个标签页占用了」）。关掉之后把缓存
      // 清掉，本标签页下一次操作会自己按新版本重开。
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('打不开本地数据库'));
    };
    // 另一个标签页正压着一个旧版本的库。不说清楚的话，这里就是一次永远不 resolve 的等待。
    req.onblocked = () => {
      dbPromise = null;
      reject(new Error('本地数据库被另一个标签页占用了，请关掉本工具的其它标签页再试'));
    };
  });

  return dbPromise;
}

function requestOf<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('本地数据库操作失败'));
  });
}

/**
 * 写操作要等事务真的提交完才算数。
 *
 * 单个 put 的 `onsuccess` 只说明请求排队成功了，事务还有可能整体失败（配额满、
 * 磁盘错）。读操作没有这个问题，写操作必须等到 `oncomplete`。
 */
function commitOf(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('本地数据库写入失败'));
    tx.onabort = () => reject(tx.error ?? new Error('本地数据库写入被中止'));
  });
}

export async function dbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB();
  const tx = db.transaction(store, 'readonly');
  const req = tx.objectStore(store).get(key) as IDBRequest<T | undefined>;
  return requestOf(req);
}

export async function dbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDB();
  const tx = db.transaction(store, 'readonly');
  const req = tx.objectStore(store).getAll() as IDBRequest<T[]>;
  return requestOf(req);
}

export async function dbPut(store: string, value: unknown): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const done = commitOf(tx);
  tx.objectStore(store).put(value);
  await done;
}

export async function dbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const done = commitOf(tx);
  tx.objectStore(store).delete(key);
  await done;
}

export async function dbClear(store: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const done = commitOf(tx);
  tx.objectStore(store).clear();
  await done;
}

export async function dbCount(store: string): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(store, 'readonly');
  const req = tx.objectStore(store).count();
  return requestOf(req);
}

/**
 * 一次事务里写多张表。
 *
 * 「一条记录 + 它的 svg」必须同生共死：分两次写的话，中间那一下断电/关页会留下
 * 一条 hasSvg=true 但没有 svg 正文的记录 —— 标本页打开就是一片空白。
 */
export async function dbPutMany(entries: { store: string; value: unknown }[]): Promise<void> {
  if (entries.length === 0) return;
  const db = await openDB();
  const stores = [...new Set(entries.map((e) => e.store))];
  const tx = db.transaction(stores, 'readwrite');
  const done = commitOf(tx);
  for (const entry of entries) tx.objectStore(entry.store).put(entry.value);
  await done;
}

/** 一次事务里删多张表的键 */
export async function dbDeleteMany(entries: { store: string; key: IDBValidKey }[]): Promise<void> {
  if (entries.length === 0) return;
  const db = await openDB();
  const stores = [...new Set(entries.map((e) => e.store))];
  const tx = db.transaction(stores, 'readwrite');
  const done = commitOf(tx);
  for (const entry of entries) tx.objectStore(entry.store).delete(entry.key);
  await done;
}

/** 一次事务里清空多张表 */
export async function dbClearMany(stores: string[]): Promise<void> {
  if (stores.length === 0) return;
  const db = await openDB();
  const tx = db.transaction(stores, 'readwrite');
  const done = commitOf(tx);
  for (const store of stores) tx.objectStore(store).clear();
  await done;
}

/** 这张库到底能不能被浏览器长期保留。可能返回 null（浏览器不支持/不给答）。 */
export async function storageInfo(): Promise<{
  persisted: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
}> {
  let persisted = false;
  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;

  try {
    if (navigator.storage?.persisted) persisted = await navigator.storage.persisted();
  } catch {
    /* 不支持就算了，界面显示「未知」 */
  }
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      usageBytes = typeof est.usage === 'number' ? est.usage : null;
      quotaBytes = typeof est.quota === 'number' ? est.quota : null;
    }
  } catch {
    /* 同上 */
  }

  return { persisted, usageBytes, quotaBytes };
}

/** 尽力申请持久化。不弹窗、不保证成功 —— Chrome/Edge 会按站点参与度自己决定。 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
