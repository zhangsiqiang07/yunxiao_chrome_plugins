/** 缓存协议与实现（对标 YXBCache.swift） */

export interface YXBCache {
  getString(key: string): Promise<string | null>;
  setString(value: string, key: string, ttl: number): Promise<void>;
  remove(key: string): Promise<void>;
}

/** 内存缓存（进程级，Token 推荐用此，不落盘） */
export class YXBInMemoryCache implements YXBCache {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async getString(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null; }
    return entry.value;
  }
  async setString(value: string, key: string, ttl: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  }
  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/** chrome.storage.local 缓存（持久化，适合非敏感数据如工作项类型） */
export class YXBChromeStorageCache implements YXBCache {
  private prefix = 'yxb_cache_';

  async getString(key: string): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get(this.prefix + key);
      const entry = result[this.prefix + key];
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        await chrome.storage.local.remove(this.prefix + key);
        return null;
      }
      return entry.value;
    } catch { return null; }
  }
  async setString(value: string, key: string, ttl: number): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.prefix + key]: { value, expiresAt: Date.now() + ttl * 1000 },
      });
    } catch { /* 静默降级 */ }
  }
  async remove(key: string): Promise<void> {
    try { await chrome.storage.local.remove(this.prefix + key); } catch { /* ignore */ }
  }
}
