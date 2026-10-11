import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_CONFIG,
  STORE_KEYS,
  STORE_META,
  STORE_RECORDS,
  STORE_SIDECARS,
  dbClearMany,
  dbCount,
  dbDelete,
  dbGet,
  dbGetAll,
  dbPut,
  openDB,
} from './idb';
import {
  VAULT_ROW,
  VaultError,
  decryptKey,
  encryptKey,
  ensureVault,
  isSecretRow,
  vaultSupported,
  type SecretRow,
} from './keyvault';
import {
  clearAllKeys,
  getApiKey,
  hasApiKey,
  keyHealth,
  readAllKeys,
  setApiKey,
  writeKeys,
} from './config';

const STORES = [STORE_CONFIG, STORE_KEYS, STORE_RECORDS, STORE_SIDECARS, STORE_META];

beforeEach(async () => {
  await dbClearMany(STORES);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ===== 「表里到底还有没有明文」的那把尺子 =====

/**
 * 把字节原样映成 latin1。
 *
 * 这是整个测试文件里最关键的一处细节：密文是二进制，`JSON.stringify` 一个
 * `ArrayBuffer` 只会给出 `{}`，直接搜字符串是**搜不到**的 —— 那样的断言恒真，
 * 等于没测。必须把每个字节当成字符摆出来，明文要是漏在密文里，ASCII 部分会原样露脸。
 */
function latin1(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

function hasNeedle(value: unknown, needle: string, seen = new Set<unknown>()): boolean {
  if (typeof value === 'string') return value.includes(needle);
  if (value instanceof ArrayBuffer) return latin1(new Uint8Array(value)).includes(needle);
  if (ArrayBuffer.isView(value)) {
    const view = value as Uint8Array;
    return latin1(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)).includes(needle);
  }
  if (Array.isArray(value)) return value.some((item) => hasNeedle(item, needle, seen));
  if (value && typeof value === 'object') {
    if (seen.has(value)) return false;
    seen.add(value);
    // 密钥柜自己是个不透明对象，没有可枚举属性，也不该被当成「明文」——
    // 它本来就是允许躺在库里的东西。
    if (typeof CryptoKey !== 'undefined' && value instanceof CryptoKey) return false;
    return Object.values(value as Record<string, unknown>).some((item) =>
      hasNeedle(item, needle, seen),
    );
  }
  return false;
}

/** 五张表全量取出来、逐字节搜一遍。 */
async function dumpHas(needle: string): Promise<boolean> {
  for (const store of STORES) {
    const rows = await dbGetAll<unknown>(store);
    if (rows.some((row) => hasNeedle(row, needle))) return true;
  }
  return false;
}

describe('扫描器自测', () => {
  it('明文在表里就必须搜得到，删掉之后就搜不到', async () => {
    await dbPut(STORE_KEYS, { id: 'p_planted', key: 'sk-planted-1234567890' });
    expect(await dumpHas('sk-planted')).toBe(true);

    await dbDelete(STORE_KEYS, 'p_planted');
    expect(await dumpHas('sk-planted')).toBe(false);
  });
});

describe('密钥柜', () => {
  it('库是 v2、有 meta 表（加密能落地的前提）', async () => {
    const db = await openDB();
    expect(db.version).toBe(2);
    expect([...db.objectStoreNames]).toContain(STORE_META);
  });

  it('这台机器上 WebCrypto 可用（下面所有加密断言的前提）', () => {
    expect(vaultSupported()).toBe(true);
  });

  it('明文 → 密文 → 明文 往返', async () => {
    const row = await encryptKey('p_a', 'sk-roundtrip-999');

    expect(isSecretRow(row)).toBe(true);
    expect(row.v).toBe(2);
    expect(row.iv).toHaveLength(12);
    expect(await decryptKey(row)).toBe('sk-roundtrip-999');
  });

  it('同一个明文两次加密得到不同的 iv 与密文', async () => {
    const a = await encryptKey('p_a', 'sk-same');
    const b = await encryptKey('p_a', 'sk-same');

    expect(latin1(a.iv)).not.toBe(latin1(b.iv));
    expect(latin1(new Uint8Array(a.ct))).not.toBe(latin1(new Uint8Array(b.ct)));
    expect(await decryptKey(b)).toBe('sk-same');
  });

  it('ensureVault 幂等：只有一行柜子，而且三次拿到的钥匙能互相解开', async () => {
    const first = await ensureVault();
    const second = await ensureVault();
    const third = await ensureVault();

    expect(await dbGetAll(STORE_META)).toHaveLength(1);
    expect(first.extractable).toBe(false); // 原始 32 字节永远读不出来
    expect(second.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      first,
      new TextEncoder().encode('跨会话仍能解开'),
    );
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, third, ct);
    expect(new TextDecoder().decode(pt)).toBe('跨会话仍能解开');
  });

  it('柜子钥匙没了 → 解不开，而且不会偷偷造一把新的', async () => {
    const row = await encryptKey('p_a', 'sk-lost');
    await dbDelete(STORE_META, VAULT_ROW);

    await expect(decryptKey(row)).rejects.toBeInstanceOf(VaultError);
    expect(await dbGetAll(STORE_META)).toHaveLength(0);
  });

  it('密文和 id 绑在一起：换个 id 就解不开（防张冠李戴）', async () => {
    const row = await encryptKey('p_a', 'sk-aad');
    await expect(decryptKey({ ...row, id: 'p_b' })).rejects.toBeInstanceOf(VaultError);
  });

  it('密文被改过一个字节 → 解不开', async () => {
    const row = await encryptKey('p_a', 'sk-tamper');
    const bytes = new Uint8Array(row.ct.slice(0));
    bytes[0] ^= 0xff;

    await expect(decryptKey({ ...row, ct: bytes.buffer })).rejects.toBeInstanceOf(VaultError);
  });
});

describe('config 的 Key 层（签名不变，里面换成密文）', () => {
  it('存进去之后，五张表里搜不到明文', async () => {
    await setApiKey('p_a', 'sk-secret-abcdefghij');

    expect(await getApiKey('p_a')).toBe('sk-secret-abcdefghij');
    expect(await dumpHas('sk-secret')).toBe(false);
    expect(await dumpHas('sk-')).toBe(false);
  });

  it('旧版留下的明文行：读得到，而且读完就变成密文', async () => {
    await dbPut(STORE_KEYS, { id: 'p_legacy', key: 'sk-legacy-old' });
    expect(await dumpHas('sk-legacy-old')).toBe(true);

    expect(await getApiKey('p_legacy')).toBe('sk-legacy-old');

    const row = await dbGet<unknown>(STORE_KEYS, 'p_legacy');
    expect(isSecretRow(row)).toBe(true);
    expect(row).not.toHaveProperty('key');
    expect(await dumpHas('sk-legacy-old')).toBe(false);
    // 升级完再读一次，拿到的还是同一把
    expect(await getApiKey('p_legacy')).toBe('sk-legacy-old');
  });

  it('readAllKeys / writeKeys 与明文时代等价（迁移与导出走的就是它们）', async () => {
    await writeKeys({ p_a: 'sk-a-1111111111', p_b: 'sk-b-2222222222' });

    expect(await readAllKeys()).toEqual({ p_a: 'sk-a-1111111111', p_b: 'sk-b-2222222222' });
    expect(await hasApiKey('p_a')).toBe(true);
    expect(await dumpHas('sk-')).toBe(false);

    const rows = await dbGetAll<unknown>(STORE_KEYS);
    expect(rows.every((row) => isSecretRow(row))).toBe(true);
  });

  it('keyHealth：顺手把旧明文行升级掉，报 encrypted=true', async () => {
    await setApiKey('p_a', 'sk-healthy');
    await dbPut(STORE_KEYS, { id: 'p_legacy', key: 'sk-healthy-legacy' });

    expect(await keyHealth()).toEqual({ broken: 0, encrypted: true });

    const rows = await dbGetAll<unknown>(STORE_KEYS);
    expect(rows.every((row) => isSecretRow(row))).toBe(true);
    expect(await dumpHas('sk-')).toBe(false);
  });

  it('解不开的 Key 当没配，但行还在，并计入 broken', async () => {
    await setApiKey('p_a', 'sk-good');
    const row = (await dbGet<SecretRow>(STORE_KEYS, 'p_a'))!;
    const bytes = new Uint8Array(row.ct.slice(0));
    bytes[1] ^= 0xff;
    await dbPut(STORE_KEYS, { ...row, ct: bytes.buffer });

    expect(await getApiKey('p_a')).toBe('');
    expect(await hasApiKey('p_a')).toBe(false);
    expect(await keyHealth()).toEqual({ broken: 1, encrypted: true });
    expect(await dbCount(STORE_KEYS)).toBe(1); // 绝不删行：删了就真没救了
  });

  it('清空所有 Key：连钥匙柜一起清，下次写入自动重建', async () => {
    await setApiKey('p_a', 'sk-a');
    await setApiKey('p_b', 'sk-b');
    expect(await dbCount(STORE_KEYS)).toBe(2);

    await clearAllKeys();

    expect(await dbCount(STORE_KEYS)).toBe(0);
    expect(await dbGetAll(STORE_META)).toHaveLength(0);
    expect(await keyHealth()).toEqual({ broken: 0, encrypted: true });

    await setApiKey('p_c', 'sk-c');
    expect(await getApiKey('p_c')).toBe('sk-c');
    expect(await dbGetAll(STORE_META)).toHaveLength(1);
  });

  it('没有 WebCrypto 就退回明文，并如实报告 encrypted=false', async () => {
    vi.stubGlobal('crypto', { ...crypto, subtle: undefined });

    expect(vaultSupported()).toBe(false);
    await setApiKey('p_a', 'sk-plain-fallback');
    expect(await getApiKey('p_a')).toBe('sk-plain-fallback');
    expect(await keyHealth()).toEqual({ broken: 0, encrypted: false });
    // 明文行就是这个样子 —— 那是唯一会被「按 sk- 扫一遍」逮住的形态，
    // 所以界面上必须说出来，而不是假装加了密。
    expect(await dumpHas('sk-plain-fallback')).toBe(true);
  });
});
