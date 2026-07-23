class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function getStorage(type: 'localStorage' | 'sessionStorage'): Storage {
  try {
    const storage = window[type];
    if (!storage) return new MemoryStorage();
    const testKey = '__safe_storage_test__';
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return storage;
  } catch {
    return new MemoryStorage();
  }
}

export const safeLocalStorage: Storage = getStorage('localStorage');
export const safeSessionStorage: Storage = getStorage('sessionStorage');
