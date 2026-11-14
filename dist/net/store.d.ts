/**
 * Where data for working offline are kept: a store of keys and JSON values.
 * IndexedDB in the browser (it survives closing the application), memory in tests.
 */
export declare abstract class OfflineStore {
    abstract get<T>(key: string): Promise<T | undefined>;
    abstract set(key: string, value: unknown): Promise<void>;
    abstract delete(key: string): Promise<void>;
    /** All entries whose keys start with the prefix, ordered by key. */
    abstract entries<T>(prefix: string): Promise<[string, T][]>;
}
/** Keeps the data in memory: for tests, or when IndexedDB is not available. */
export declare class MemoryStore extends OfflineStore {
    private data;
    get<T>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
    entries<T>(prefix: string): Promise<[string, T][]>;
}
/** Keeps the data in IndexedDB, in a database of the given name with one store. */
export declare class IndexedDbStore extends OfflineStore {
    private name;
    private db;
    constructor(name: string);
    get<T>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
    entries<T>(prefix: string): Promise<[string, T][]>;
    private open;
    private request;
}
