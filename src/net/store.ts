/**
 * Where data for working offline are kept: a store of keys and JSON values.
 * IndexedDB in the browser (it survives closing the application), memory in tests.
 */

export abstract class OfflineStore {
  public abstract get<T>(key: string): Promise<T | undefined>;
  public abstract set(key: string, value: unknown): Promise<void>;
  public abstract delete(key: string): Promise<void>;
  /** All entries whose keys start with the prefix, ordered by key. */
  public abstract entries<T>(prefix: string): Promise<[string, T][]>;
}

/** Keeps the data in memory: for tests, or when IndexedDB is not available. */
export class MemoryStore extends OfflineStore {
  private data = new Map<string, unknown>();

  public async get<T>(key: string): Promise<T | undefined> {
    return structuredClone(this.data.get(key)) as T | undefined;
  }

  public async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, structuredClone(value));
  }

  public async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  public async entries<T>(prefix: string): Promise<[string, T][]> {
    return [...this.data.entries()].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, structuredClone(value) as T]);
  }
}

/** Keeps the data in IndexedDB, in a database of the given name with one store. */
export class IndexedDbStore extends OfflineStore {
  private db: Promise<IDBDatabase> | null = null;

  public constructor(private name: string) {
    super();
  }

  public async get<T>(key: string): Promise<T | undefined> {
    return this.request<T | undefined>('readonly', store => store.get(key));
  }

  public async set(key: string, value: unknown): Promise<void> {
    await this.request('readwrite', store => store.put(value, key));
  }

  public async delete(key: string): Promise<void> {
    await this.request('readwrite', store => store.delete(key));
  }

  public async entries<T>(prefix: string): Promise<[string, T][]> {
    const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
    const [keys, values] = await Promise.all([
      this.request<IDBValidKey[]>('readonly', store => store.getAllKeys(range)),
      this.request<T[]>('readonly', store => store.getAll(range)),
    ]);
    return keys.map((key, index) => [String(key), values[index]!]);
  }

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('data');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.db;
  }

  private async request<T>(mode: IDBTransactionMode, make: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = make(db.transaction('data', mode).objectStore('data'));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  }
}
