import { afterEach, describe, expect, test } from 'vitest';
import { MemoryStore, RpcClient, RpcError, RpcMockError, RpcOffline, createRpcMock, online } from '../src/net/index';
import type { OfflineRules } from '../src/net/index';

interface Task { id: number; title: string; status: string; updated: string }

interface Methods {
  'task.read': { params: { id: number }; result: Task };
  'task.list': { params: { status?: string }; result: Task[] };
  'task.update': { params: { id: number; status: string }; result: Task };
}

const goOffline = () => window.dispatchEvent(new Event('offline'));
const goOnline = () => window.dispatchEvent(new Event('online'));
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

afterEach(goOnline);

/** A server with two tasks, and a client with the offline layer over it. */
function setup(store = new MemoryStore(), scope = 'jana') {
  const tasks: Task[] = [
    { id: 1, title: 'Export', status: 'open', updated: 'v1' },
    { id: 2, title: 'Zálohy', status: 'open', updated: 'v1' },
  ];
  const server = createRpcMock<Methods>({
    'task.read': ({ id }) => ({ ...tasks.find(task => task.id === id)! }),
    'task.list': ({ status }) => tasks.filter(task => !status || task.status === status).map(task => ({ ...task })),
    'task.update': ({ id, status }) => {
      if (status === 'nonsense') throw new RpcMockError(-32602, 'Invalid params', { status: 'Neznámý stav.' });
      const task = tasks.find(other => other.id === id)!;
      Object.assign(task, { status, updated: `v${Number(task.updated.slice(1)) + 1}` });
      return { ...task };
    },
  });
  const rules: OfflineRules<Methods> = {
    reads: {
      'task.read': {},
      // A list with another filter is computed from the kept records
      'task.list': {
        offline: async ({ status }, cache) => (await cache.all<Task>('task.read')).map(entry => entry.value)
          .filter(task => !status || task.status === status),
      },
    },
    writes: {
      'task.update': {
        apply: async ({ id, status }, cache) => {
          const task = { ...(await cache.get<Task>('task.read', { id }))!, status };
          await cache.set('task.read', { id }, task);
          return task;
        },
        version: async ({ id }, cache) => (await cache.get<Task>('task.read', { id }))?.updated,
        current: async ({ id }, call) => ((await call('task.read', { id })) as Task).updated,
        describe: ({ id, status }) => `Úkol ${id}: ${status}`,
      },
    },
  };
  const offline = new RpcOffline<Methods>(store, rules, () => scope);
  const api = new RpcClient<Methods>('/rpc', { fetch: server.fetch, offline });
  return { tasks, server, offline, api, store };
}

describe('RpcOffline', () => {
  test('reads: kept online, given back offline, a list computed from kept records, nothing prepared is an error', async () => {
    const { api, offline } = setup();
    await offline.download([['task.read', { id: 1 }], ['task.read', { id: 2 }]]);
    expect(offline.downloaded()).not.toBeNull();
    goOffline();
    expect(online()).toBe(false);
    expect((await api.call('task.read', { id: 1 })).title).toBe('Export');
    expect((await api.call('task.list', { status: 'open' })).map(task => task.id)).toEqual([1, 2]);
    const missing = await api.call('task.read', { id: 9 }).catch((error: RpcError) => error);
    expect(missing).toBeInstanceOf(RpcError);
    expect((missing as RpcError).code).toBe(0);
  });

  test('writes offline: applied to kept data at once, waiting, sent when the network is back', async () => {
    const { api, offline, server, tasks } = setup();
    await offline.download([['task.read', { id: 1 }], ['task.read', { id: 2 }]]);
    let synced = 0;
    offline.onSynced(() => synced++);
    goOffline();
    const result = await api.call('task.update', { id: 1, status: 'closed' });
    expect(result.status).toBe('closed');
    expect((await api.call('task.read', { id: 1 })).status).toBe('closed');
    expect(offline.pending().map(change => change.title)).toEqual(['Úkol 1: closed']);
    expect(tasks[0]!.status).toBe('open');

    goOnline();
    await settle();
    expect(tasks[0]!.status).toBe('closed');
    expect(offline.pending()).toEqual([]);
    expect(synced).toBe(1);
    expect(server.calls.filter(call => call.method === 'task.update')).toHaveLength(1);
  });

  test('a record changed on the server meanwhile: the change waits for the user, who sends it or drops it', async () => {
    const { api, offline, tasks } = setup();
    await offline.download([['task.read', { id: 1 }], ['task.read', { id: 2 }]]);
    goOffline();
    await api.call('task.update', { id: 1, status: 'closed' });
    await api.call('task.update', { id: 2, status: 'closed' });
    // Somebody in the office changed task 1
    Object.assign(tasks[0]!, { status: 'progress', updated: 'v7' });

    goOnline();
    await settle();
    expect(offline.conflicts().map(change => change.title)).toEqual(['Úkol 1: closed']);
    expect(tasks[1]!.status).toBe('closed');

    await offline.resolve(offline.conflicts()[0]!, 'send');
    expect(tasks[0]!.status).toBe('closed');
    expect(offline.conflicts()).toEqual([]);
  });

  test('a change the server refuses goes to failed; changes survive closing the application, per user', async () => {
    const store = new MemoryStore();
    const first = setup(store);
    await first.offline.download([['task.read', { id: 1 }]]);
    goOffline();
    await first.api.call('task.update', { id: 1, status: 'nonsense' });

    // The application is closed and opened again, by the same user and by another one
    const again = setup(store);
    const other = setup(store, 'petr');
    await again.offline.sync();
    await other.offline.sync();
    expect(again.offline.pending().map(change => change.title)).toEqual(['Úkol 1: nonsense']);
    expect(other.offline.pending()).toEqual([]);

    // Back online the server refuses it: it waits in failed with the reason, also after opening again
    goOnline();
    await settle();
    expect(first.offline.failed().map(change => change.error)).toEqual(['task.update: Invalid params']);
    const later = setup(store);
    await later.offline.sync();
    expect(later.offline.failed()).toHaveLength(1);
    await later.offline.drop(later.offline.failed()[0]!);
    expect(await store.entries('jana|change:')).toEqual([]);
  });
});
