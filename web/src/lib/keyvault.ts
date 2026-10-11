/**
 * API Key 的密钥柜。
 *
 * 以前 Key 是明文躺在 IndexedDB 的 `keys` 表里的。现在这一层做的事只有一件：
 * 库里放密文，钥匙放在同一张库的 `meta` 表里（`vault-key` 一行）。
 *
 * ## 这把钥匙保护的是什么
 *
 * 挡得住：有人翻 DevTools → IndexedDB、有人按 `sk-` 扫硬盘/扫浏览器 profile
 * 目录、有人把这张表整份 dump 走当 JSON 看 —— 表里只有 `iv` + `ct`。
 *
 * 挡不住（别把话说满）：能跑在同一个源里的脚本。用 `file://` 打开时，整台机器上
 * 所有本地 html 页面都算同一个源，它们既能读这张表，也能读走柜子里那把钥匙。
 * 也挡不住「整份浏览器 profile 被拷到另一台机器」—— 钥匙和密文装在同一个 profile
 * 里，会一起被搬走。
 *
 * 真正要防住上面这两条，得让钥匙不由浏览器保管（口令 / 生物识别）。那要每次开页
 * 都要一次交互，与「不影响正常使用」冲突，所以这一版没做；钩子在下面两个函数上：
 * `readVaultKey()` 和 `ensureVault()` —— 换成「用口令派生的 KEK 把柜子钥匙包起来」，
 * 上层一行都不用改。
 *
 * ## 为什么 key 可以直接存进 IndexedDB
 *
 * 结构化克隆支持 `CryptoKey`（规范里是 `[[serialized]]` 内部槽），Chrome/Edge 与
 * Node 24 的原生 `structuredClone` 都认；本仓库测试用的 `fake-indexeddb@6` 内部调
 * 的正是全局 `structuredClone`，所以测试环境和真浏览器走的是同一条路（已实测：
 * 取回来仍是 `extractable === false` 的 AES-GCM 密钥，能正常解密）。
 * `extractable: false` 的意义是「没有任何 JS 代码能把 32 字节原始密钥读出来」。
 */

import { STORE_META, dbDelete, dbGet, dbPut } from './idb';

/** `meta` 表里放柜子钥匙的那一行 */
export const VAULT_ROW = 'vault-key';

/** 密文行：`v: 2` 是格式版本，方便以后换算法 */
export interface SecretRow {
  id: string;
  v: 2;
  iv: Uint8Array;
  ct: ArrayBuffer;
}

/** 旧版留下的明文行。只在「读到顺手升级」和「浏览器没有 WebCrypto」时出现。 */
export interface LegacyRow {
  id: string;
  key: string;
}

export type KeyRow = SecretRow | LegacyRow;

export type VaultFailure = 'unsupported' | 'missing' | 'corrupt';

export class VaultError extends Error {
  code: VaultFailure;

  constructor(code: VaultFailure, message: string) {
    super(message);
    this.name = 'VaultError';
    this.code = code;
  }
}

/** 这个浏览器能不能做 WebCrypto。不能的话上层退回明文，界面会说出来。 */
export function vaultSupported(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle?.encrypt === 'function' &&
    typeof crypto.subtle?.decrypt === 'function'
  );
}

export function isSecretRow(row: unknown): row is SecretRow {
  const r = row as Partial<SecretRow> | null | undefined;
  return Boolean(r) && r?.v === 2 && r.ct instanceof ArrayBuffer && r.iv instanceof Uint8Array;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * 把密文绑到它那一行的 id 上（AES-GCM 的 additionalData）。
 *
 * 少了这一步，谁把 A 供应商的密文行贴到 B 供应商名下，程序就会拿 A 的 Key 去请求
 * B 的站 —— 结果是一串看不懂的 401。绑上之后这种张冠李戴会在解密时就失败。
 */
function aadOf(providerId: string): Uint8Array {
  return encoder.encode(`pelican-bench:key:${providerId}`);
}

/**
 * 把字节视图交给 WebCrypto 时用一下。
 *
 * TS 5.7 起 `Uint8Array` 默认的 buffer 类型是 `ArrayBufferLike`（可能是 SharedArrayBuffer），
 * 而 `BufferSource` 只收 `ArrayBuffer` 底的那一种。这两个数组都是本函数自己造的、长度固定，
 * 在这里收窄一次，比让泛型参数沿着 `SecretRow` 传染到所有调用方干净。
 */
function src(bytes: Uint8Array): BufferSource {
  return bytes as BufferSource;
}

function isCryptoKey(value: unknown): value is CryptoKey {
  return typeof CryptoKey !== 'undefined' && value instanceof CryptoKey;
}

/** 只读柜子，不生成。解密路径专用：拿新钥匙开旧锁只会白写一行，还把「还有救」变成「彻底没救」。 */
export async function readVaultKey(): Promise<CryptoKey | null> {
  const row = await dbGet<{ id: string; key?: unknown }>(STORE_META, VAULT_ROW);
  return isCryptoKey(row?.key) ? row.key : null;
}

async function generateVaultKey(): Promise<CryptoKey> {
  // 锁内重读：另一个标签页可能刚好已经建好了，那就用它的。
  const again = await readVaultKey();
  if (again) return again;

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  await dbPut(STORE_META, { id: VAULT_ROW, v: 1, key });
  return key;
}

/**
 * 拿到柜子钥匙，没有就造一把。
 *
 * 外面套 `navigator.locks` 是为了两个标签页同时首次使用时不要各造一把 —— 后写的那把
 * 会让前一把加密的行永远解不开。没有 Web Locks 的浏览器靠上面的「锁内重读」兜底。
 */
export async function ensureVault(): Promise<CryptoKey> {
  if (!vaultSupported()) {
    throw new VaultError('unsupported', '这个浏览器不支持 WebCrypto，没法加密保存 API Key');
  }

  const existing = await readVaultKey();
  if (existing) return existing;

  const locks = (globalThis as { navigator?: { locks?: Pick<LockManager, 'request'> } }).navigator
    ?.locks;
  if (locks?.request) return locks.request('pelican-bench-vault', generateVaultKey);
  return generateVaultKey();
}

/** 明文 → 密文行。同一个明文两次加密会得到不同的 iv 与密文。 */
export async function encryptKey(providerId: string, plain: string): Promise<SecretRow> {
  const key = await ensureVault();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: src(iv), additionalData: src(aadOf(providerId)) },
    key,
    encoder.encode(plain),
  );
  return { id: providerId, v: 2, iv, ct };
}

/** 密文行 → 明文。柜子不在、钥匙换过、字节被改都会抛 `VaultError`，由上层决定怎么说。 */
export async function decryptKey(row: SecretRow): Promise<string> {
  if (!vaultSupported()) {
    throw new VaultError('unsupported', '这个浏览器不支持 WebCrypto，读不了加密的 API Key');
  }

  const key = await readVaultKey();
  if (!key) {
    throw new VaultError('missing', '这把 Key 是加密的，但钥匙柜里没有对应的密钥了');
  }

  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: src(row.iv), additionalData: src(aadOf(row.id)) },
      key,
      row.ct,
    );
    return decoder.decode(plain);
  } catch {
    throw new VaultError('corrupt', `「${row.id}」这把 Key 解不开（钥匙换过，或者数据坏了）`);
  }
}

/** 「清空所有 Key」连柜子一起清。清空之后是「就当没存过」，下次写入时自动重建。 */
export async function dropVault(): Promise<void> {
  await dbDelete(STORE_META, VAULT_ROW);
}
