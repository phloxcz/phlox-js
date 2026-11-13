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

import { state, untrack } from '../reactive/reactive';
import type { State } from '../reactive/reactive';
import { online } from './online';
import { RpcError, RpcErrorCode } from './rpc';
import type { RpcMethod } from './rpc';
import { OfflineStore } from './store';

/** The kept data, for `offline` and `apply` of the rules. */
export interface OfflineCache {
  /** The kept result of a reading call, undefined when it was never loaded. */
  get<T = any>(method: string, params?: object): Promise<T | undefined>;
  set(method: string, params: object | undefined, value: unknown): Promise<void>;
  /** All kept results of a method, e.g. every task.read, for answers computed in the browser. */
  all<T = any>(method: string): Promise<{ params: any; value: T }[]>;
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

export interface OfflineRules<M extends { [K in keyof M]: RpcMethod }> {
  reads?: { [K in keyof M]?: ReadRule<M[K]['params'], M[K]['result']> };
  writes?: { [K in keyof M]?: WriteRule<M[K]['params'], M[K]['result']> };
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

const isNetworkError = (error: unknown) => error instanceof RpcError && error.code === RpcErrorCode.Network;

export class RpcOffline<M extends { [K in keyof M]: RpcMethod } = any> {
  /** Changes waiting to be sent. */
  readonly pending: State<OfflineChange[]> = state([]);
  /** Changes of records that changed on the server meanwhile; resolve() decides each. */
  readonly conflicts: State<OfflineChange[]> = state([]);
  /** Changes the server refused (validation, permission); retry() or drop(). */
  readonly failed: State<OfflineChange[]> = state([]);
  readonly syncing = state(false);
  /** When the data for offline were last downloaded, ISO, null when never. */
  readonly downloaded = state<string | null>(null);

  private send: Send | null = null;
  private listeners: (() => void)[] = [];
  private loaded: Promise<void> | null = null;
  private counter = 0;

  /**
   * @param scope the owner of the data, e.g. `() => String(user.getId())`: data and changes of one user
   *              are never shown to or sent for another one
   */
  constructor(private store: OfflineStore, private rules: OfflineRules<M>, private scope: () => string = () => '') {
    if (typeof window !== 'undefined') window.addEventListener('online', () => void this.sync());
  }

  /** Whether the client should ask this object about the method. */
  handles(method: string): boolean {
    return method in (this.rules.reads ?? {}) || method in (this.rules.writes ?? {});
  }

  /** Called by RpcClient with its way of calling the server. */
  attach(send: Send): void {
    this.send = send;
  }

  /** After changes were sent: lists can load again, e.g. app.invalidate('tasks'). Returns a function that stops it. */
  onSynced(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(other => other !== listener); };
  }

  /** A call of a method in the rules, from RpcClient. */
  async call(method: string, params: any): Promise<unknown> {
    await this.load();
    const read = (this.rules.reads as Record<string, ReadRule<any, any>> | undefined)?.[method];
    if (read) return this.read(method, params, read);
    const write = (this.rules.writes as Record<string, WriteRule<any, any>>)[method]!;
    if (untrack(online)) {
      try {
        return await this.send!(method, params);
      } catch (error) {
        if (!isNetworkError(error)) throw error;
      }
    }
    return this.queue(method, params, write);
  }

  /**
   * Downloads data for working offline: each call is made and kept, e.g. the tasks of the chosen project
   * and the detail of each of them. Calls made at once go as one batch.
   */
  async download(calls: [method: keyof M & string, params?: object][]): Promise<void> {
    await this.load();
    await Promise.all(calls.map(async ([method, params]) => this.cache.set(method, params, await this.send!(method, params))));
    const now = new Date().toISOString();
    this.downloaded.set(now);
    await this.store.set(this.key('meta:downloaded'), now);
  }

  /** Sends the waiting changes one by one. Changes of records changed meanwhile go to `conflicts`. */
  async sync(): Promise<void> {
    await this.load();
    if (untrack(this.syncing) || !this.send || !untrack(online)) return;
    this.syncing.set(true);
    let sent = 0;
    // One tab at a time: two open tabs would send the same queue twice. In the lock the queue is read
    // again, another tab may have sent part of it meanwhile.
    const run = async () => {
      await this.load(true);
      for (const change of untrack(this.pending)) {
        const rule = (this.rules.writes as Record<string, WriteRule<any, any>>)[change.method];
        if (rule?.current && change.version !== undefined) {
          const now = await rule.current(change.params, (method, params) => this.send!(method, params));
          if (now !== change.version) {
            await this.move(change, 'conflicts');
            continue;
          }
        }
        if (!(await this.deliver(change))) break;
        sent++;
      }
    };
    try {
      const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
      if (locks) await locks.request(this.key('sync'), run);
      else await run();
    } finally {
      this.syncing.set(false);
    }
    if (sent) for (const listener of this.listeners) listener();
  }

  /** The user decided about a change of a record changed meanwhile: send it anyway, or drop it. */
  async resolve(change: OfflineChange, decision: 'send' | 'drop'): Promise<void> {
    this.conflicts.update(list => list.filter(other => other.key !== change.key));
    if (decision === 'drop') {
      await this.store.delete(this.key(`change:${change.key}`));
      return;
    }
    if (await this.deliver(change)) for (const listener of this.listeners) listener();
  }

  /** Sends a refused change again, e.g. after the user fixed what the server refused. */
  async retry(change: OfflineChange): Promise<void> {
    this.failed.update(list => list.filter(other => other.key !== change.key));
    if (await this.deliver(change)) for (const listener of this.listeners) listener();
  }

  /** Drops a refused change. */
  async drop(change: OfflineChange): Promise<void> {
    this.failed.update(list => list.filter(other => other.key !== change.key));
    await this.store.delete(this.key(`change:${change.key}`));
  }

  /** Forgets the kept data of the current user (not the changes waiting to be sent). */
  async clearCache(): Promise<void> {
    for (const [key] of await this.store.entries(this.key('read:'))) await this.store.delete(key);
    this.downloaded.set(null);
    await this.store.delete(this.key('meta:downloaded'));
  }

  /** The kept data, also for code of the application. */
  readonly cache: OfflineCache = {
    get: async (method, params) => (await this.store.get<{ value: any }>(this.readKey(method, params)))?.value,
    set: (method, params, value) => this.store.set(this.readKey(method, params), { params: params ?? {}, value }),
    all: async method => (await this.store.entries<{ params: any; value: any }>(this.key(`read:${method}:`))).map(([, entry]) => entry),
  };

  private async read(method: string, params: any, rule: ReadRule<any, any>): Promise<unknown> {
    if (untrack(online)) {
      try {
        const result = await this.send!(method, params);
        await this.store.set(this.readKey(method, params), { params: params ?? {}, value: result });
        return result;
      } catch (error) {
        if (!isNetworkError(error)) throw error;
      }
    }
    const kept = await this.store.get<{ value: unknown }>(this.readKey(method, params));
    if (kept) return kept.value;
    const computed = await rule.offline?.(params, this.cache);
    if (computed !== undefined) return computed;
    throw new RpcError(RpcErrorCode.Network, 'Offline: these data were not prepared for working offline.', {}, method);
  }

  private async queue(method: string, params: any, rule: WriteRule<any, any>): Promise<unknown> {
    const version = await rule.version?.(params, this.cache);
    const change: OfflineChange = {
      key: `${Date.now().toString(36).padStart(10, '0')}-${(++this.counter).toString(36).padStart(4, '0')}`,
      method,
      params,
      made: new Date().toISOString(),
      ...(version !== undefined ? { version } : {}),
      title: (await rule.describe?.(params, this.cache)) ?? method,
    };
    // Applied before it is kept: a failing apply (an unprepared record) must not leave a change behind
    const result = await rule.apply(params, this.cache);
    await this.store.set(this.key(`change:${change.key}`), change);
    this.pending.update(list => [...list, change]);
    return result;
  }

  /** Sends one change. False when the network is gone again or the user is not signed in: the rest waits. */
  private async deliver(change: OfflineChange): Promise<boolean> {
    try {
      await this.send!(change.method, change.params);
    } catch (error) {
      if (isNetworkError(error) || (error instanceof RpcError && error.code === RpcErrorCode.Unauthorized)) return false;
      await this.move({ ...change, error: error instanceof Error ? error.message : String(error) }, 'failed');
      return true;
    }
    await this.store.delete(this.key(`change:${change.key}`));
    this.pending.update(list => list.filter(other => other.key !== change.key));
    return true;
  }

  private async move(change: OfflineChange, to: 'conflicts' | 'failed'): Promise<void> {
    this.pending.update(list => list.filter(other => other.key !== change.key));
    this[to].update(list => [...list, change]);
    await this.store.set(this.key(`change:${change.key}`), { ...change, state: to });
  }

  /** Loads the waiting changes of the current user, once per user. */
  private load(again = false): Promise<void> {
    const scope = this.scope();
    if (this.loaded && this.loadedScope === scope && !again) return this.loaded;
    this.loadedScope = scope;
    this.loaded = (async () => {
      const changes = (await this.store.entries<OfflineChange & { state?: 'conflicts' | 'failed' }>(this.key('change:'))).map(([, change]) => change);
      this.pending.set(changes.filter(change => !change.state));
      this.conflicts.set(changes.filter(change => change.state === 'conflicts'));
      this.failed.set(changes.filter(change => change.state === 'failed'));
      this.downloaded.set((await this.store.get<string>(this.key('meta:downloaded'))) ?? null);
    })();
    return this.loaded;
  }

  private loadedScope: string | null = null;

  private key(rest: string): string {
    return `${this.scope()}|${rest}`;
  }

  private readKey(method: string, params: object | undefined): string {
    return this.key(`read:${method}:${stableJson(params ?? {})}`);
  }
}

/** JSON with keys sorted, so the same parameters in another order are the same key. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter(key => (value as Record<string, unknown>)[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
