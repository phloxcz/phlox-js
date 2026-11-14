/**
 * Working offline: results of reading methods are kept, writing methods go to a queue while there is
 * no network and are sent when it is back. Generic, the application only says which methods are which:
 *
 *   const offline = new RpcOffline<RpcMethods>(new IndexedDbStore('helpdesk'), {
 *     reads: { 'task.read': {}, 'task.list': { offline: (params, cache) => … } },
 *     writes: { 'task.update': { apply: (params, cache) => …, version: … } },
 *   });
 *   services.add(new RpcApi('/rpc', { offline }));
 *
 * Collisions are not merged. When a record changed on the server after it was saved offline,
 * the change waits in `conflicts` and the user decides: send it anyway, or drop it.
 */
import type { State } from '../reactive/reactive';
import type { RpcMethod } from './rpc';
import { OfflineStore } from './store';
/** The kept data, for `offline` and `apply` of the rules. */
export interface OfflineCache {
    /** The kept result of a reading call, undefined when it was never loaded. */
    get<T = any>(method: string, params?: object): Promise<T | undefined>;
    set(method: string, params: object | undefined, value: unknown): Promise<void>;
    /** All kept results of a method, e.g. every task.read, for answers computed in the browser. */
    all<T = any>(method: string): Promise<{
        params: any;
        value: T;
    }[]>;
}
export interface ReadRule<P, R> {
    /**
     * An answer offline when this very call was never kept, computed from other kept data:
     * a list with another filter from the kept records. Undefined means there is no answer.
     */
    offline?: (params: P, cache: OfflineCache) => Promise<R | undefined> | R | undefined;
}
export interface WriteRule<P, R> {
    /** What the call does to the kept data (so the screens show it at once) and what it returns offline. */
    apply: (params: P, cache: OfflineCache) => Promise<R> | R;
    /**
     * The version of the record the change is made on, e.g. its time of the last change. Taken from the kept
     * data when the change is queued, and from the server (`current`) before it is sent; when they differ,
     * the change waits for the user in `conflicts`.
     */
    version?: (params: P, cache: OfflineCache) => Promise<string | number | null | undefined> | string | number | null | undefined;
    /** The version of the record on the server now, by a call of a reading method. */
    current?: (params: P, call: (method: string, params?: object) => Promise<any>) => Promise<string | number | null | undefined>;
    /** A name of the change for people: "Úkol Oprava exportu: změna". It may read the kept data. */
    describe?: (params: P, cache: OfflineCache) => Promise<string> | string;
}
export interface OfflineRules<M extends {
    [K in keyof M]: RpcMethod;
}> {
    reads?: {
        [K in keyof M]?: ReadRule<M[K]['params'], M[K]['result']>;
    };
    writes?: {
        [K in keyof M]?: WriteRule<M[K]['params'], M[K]['result']>;
    };
}
/** A change made offline, waiting to be sent. */
export interface OfflineChange {
    /** Generated in the browser, also the order of sending. */
    key: string;
    method: string;
    params: any;
    /** When it was made, ISO. */
    made: string;
    /** The version of the record when it was made, see WriteRule.version. */
    version?: string | number | null;
    /** For people, see WriteRule.describe. */
    title: string;
    /** Why the server refused it, for `failed`. */
    error?: string;
}
type Send = (method: string, params?: object) => Promise<unknown>;
export declare class RpcOffline<M extends {
    [K in keyof M]: RpcMethod;
} = any> {
    private store;
    private rules;
    private scope;
    /** Changes waiting to be sent. */
    readonly pending: State<OfflineChange[]>;
    /** Changes of records that changed on the server meanwhile; resolve() decides each. */
    readonly conflicts: State<OfflineChange[]>;
    /** Changes the server refused (validation, permission); retry() or drop(). */
    readonly failed: State<OfflineChange[]>;
    readonly syncing: State<boolean>;
    /** When the data for offline were last downloaded, ISO, null when never. */
    readonly downloaded: State<string | null>;
    private send;
    private listeners;
    private loaded;
    private counter;
    /**
     * @param scope the owner of the data, e.g. `() => String(user.getId())`: data and changes of one user
     *              are never shown to or sent for another one
     */
    constructor(store: OfflineStore, rules: OfflineRules<M>, scope?: () => string);
    /** Whether the client should ask this object about the method. */
    handles(method: string): boolean;
    /** Called by RpcClient with its way of calling the server. */
    attach(send: Send): void;
    /** After changes were sent: lists can load again, e.g. app.invalidate('tasks'). Returns a function that stops it. */
    onSynced(listener: () => void): () => void;
    /** A call of a method in the rules, from RpcClient. */
    call(method: string, params: any): Promise<unknown>;
    /**
     * Downloads data for working offline: each call is made and kept, e.g. the tasks of the chosen project
     * and the detail of each of them. Calls made at once go as one batch.
     */
    download(calls: [method: keyof M & string, params?: object][]): Promise<void>;
    /** Sends the waiting changes one by one. Changes of records changed meanwhile go to `conflicts`. */
    sync(): Promise<void>;
    /** The user decided about a change of a record changed meanwhile: send it anyway, or drop it. */
    resolve(change: OfflineChange, decision: 'send' | 'drop'): Promise<void>;
    /** Sends a refused change again, e.g. after the user fixed what the server refused. */
    retry(change: OfflineChange): Promise<void>;
    /** Drops a refused change. */
    drop(change: OfflineChange): Promise<void>;
    /** Forgets the kept data of the current user (not the changes waiting to be sent). */
    clearCache(): Promise<void>;
    /** The kept data, also for code of the application. */
    readonly cache: OfflineCache;
    private read;
    private queue;
    /** Sends one change. False when the network is gone again or the user is not signed in: the rest waits. */
    private deliver;
    private move;
    /** Loads the waiting changes of the current user, once per user. */
    private load;
    private loadedScope;
    private key;
    private readKey;
}
export {};
