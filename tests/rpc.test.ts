import { describe, expect, test } from 'vitest';
import { RpcClient, RpcError, RpcErrorCode } from '../src/net/index';
import type { RpcMethods } from './fixtures/sample-rpc';
import { SampleApi } from './fixtures/sample-rpc';

interface Request {
  jsonrpc: string;
  method: string;
  params?: Record<string, unknown>;
  id?: number;
}

/** A fake server: answers every call by the handler, records what it got. */
function server(handler: (call: Request) => unknown, options: { status?: number; raw?: unknown } = {}) {
  const sent: { url: string; body: Request | Request[]; headers: Record<string, string>; credentials?: RequestCredentials }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Request | Request[];
    sent.push({ url, body, headers: init.headers as Record<string, string>, ...(init.credentials ? { credentials: init.credentials } : {}) });
    if (options.status) return new Response('', { status: options.status, statusText: 'Bad Gateway' });
    const calls = Array.isArray(body) ? body : [body];
    const answers = calls.filter(call => 'id' in call).map(call => {
      try {
        return { jsonrpc: '2.0', result: handler(call), id: call.id };
      } catch (error) {
        return { jsonrpc: '2.0', error: error as object, id: call.id };
      }
    });
    const payload = options.raw ?? (answers.length === 0 ? null : Array.isArray(body) ? answers : answers[0]);
    return payload === null ? new Response(null, { status: 204 }) : Response.json(payload);
  }) as typeof globalThis.fetch;
  return { fetch, sent };
}

describe('RpcClient', () => {
  test('calls a method with named parameters and returns the result', async () => {
    const { fetch, sent } = server(call => ({ echo: call.params }));
    const rpc = new RpcClient('/rpc', { fetch });
    expect(await rpc.call('user.read', { id: 1 })).toEqual({ echo: { id: 1 } });
    expect(sent[0]!.body).toEqual({ jsonrpc: '2.0', method: 'user.read', params: { id: 1 }, id: 1 });
    expect(sent[0]!.headers['Content-Type']).toBe('application/json');
  });

  test('calls made at the same time go as one batch, each gets its own result', async () => {
    const { fetch, sent } = server(call => `${call.method} ${call.params?.n}`);
    const rpc = new RpcClient('/rpc', { fetch });
    const results = await Promise.all([rpc.call('a', { n: 1 }), rpc.call('b', { n: 2 }), rpc.call('c', { n: 3 })]);
    expect(results).toEqual(['a 1', 'b 2', 'c 3']);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toHaveLength(3);
  });

  test('batching can be switched off', async () => {
    const { fetch, sent } = server(() => true);
    const rpc = new RpcClient('/rpc', { fetch, batch: false });
    await Promise.all([rpc.call('a'), rpc.call('b')]);
    expect(sent).toHaveLength(2);
  });

  test('an error rejects only its own call, with code, message and data', async () => {
    const { fetch } = server(call => {
      if (call.method === 'bad') throw { code: -32602, message: 'Invalid method parameter(s).', fields: { 'input.name': 'Required.' } };
      return 'ok';
    });
    const rpc = new RpcClient('/rpc', { fetch });
    const [good, bad] = await Promise.allSettled([rpc.call('good'), rpc.call('bad')]);
    expect(good).toEqual({ status: 'fulfilled', value: 'ok' });
    const error = (bad as PromiseRejectedResult).reason as RpcError;
    expect(error).toBeInstanceOf(RpcError);
    expect(error.code).toBe(RpcErrorCode.InvalidParams);
    expect(error.method).toBe('bad');
    expect(error.data).toEqual({ fields: { 'input.name': 'Required.' } });
    expect(error.message).toBe('bad: Invalid method parameter(s).');
  });

  test('an error without id fails every call of the request', async () => {
    const { fetch } = server(() => 'never', {
      raw: { jsonrpc: '2.0', error: { code: -32600, message: 'Batch is too large.' }, id: null },
    });
    const rpc = new RpcClient('/rpc', { fetch });
    const results = await Promise.allSettled([rpc.call('a'), rpc.call('b')]);
    for (const result of results) expect(((result as PromiseRejectedResult).reason as RpcError).code).toBe(-32600);
  });

  test('a missing response, an HTTP error and a network error are RpcErrors', async () => {
    const empty = new RpcClient('/rpc', { fetch: server(() => 1, { raw: [] }).fetch });
    await expect(empty.call('a')).rejects.toMatchObject({ code: RpcErrorCode.InternalError });

    const http = new RpcClient('/rpc', { fetch: server(() => 1, { status: 502 }).fetch });
    await expect(http.call('a')).rejects.toMatchObject({ code: 502, message: 'HTTP 502 Bad Gateway' });

    const offline = new RpcClient('/rpc', { fetch: (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch });
    await expect(offline.call('a')).rejects.toMatchObject({ code: RpcErrorCode.Network, message: 'Network error: Failed to fetch' });
  });

  test('a notification has no id and resolves without a result', async () => {
    const { fetch, sent } = server(() => 'ignored');
    const rpc = new RpcClient('/rpc', { fetch });
    await expect(rpc.notify('log.write', { text: 'x' })).resolves.toBeUndefined();
    expect('id' in (sent[0]!.body as Request)).toBe(false);
  });

  test('headers are read for every request, credentials are passed on', async () => {
    let token = 'first';
    const { fetch, sent } = server(() => 1);
    const rpc = new RpcClient('/rpc', { fetch, credentials: 'include', headers: () => ({ Authorization: `Bearer ${token}` }) });
    await rpc.call('a');
    token = 'second';
    await rpc.call('a');
    expect(sent.map(request => request.headers.Authorization)).toEqual(['Bearer first', 'Bearer second']);
    expect(sent[0]!.credentials).toBe('include');
  });

  test('the generated client checks method names, parameters and results', async () => {
    const { fetch } = server(() => ({ data: [{ id: 1, name: 'Task' }], total: 1, page: 1, pageSize: 10, from: 0, to: 0 }));
    const api = new SampleApi('/rpc', { fetch });
    const tasks = await api.call('stats.tasks', { query: { search: 'x', sort: [{ field: 'name', dir: 'desc' }] } });
    expect(tasks.data[0]!.name).toBe('Task');

    // every parameter of stats.tasks is optional, so they may be left out
    void (() => api.call('stats.tasks'));
    // @ts-expect-error unknown method
    void (() => api.call('stats.task'));
    // @ts-expect-error unknown field to sort by
    void (() => api.call('stats.tasks', { query: { sort: [{ field: 'title' }] } }));
    const result: RpcMethods['stats.tasks']['result'] = tasks;
    // @ts-expect-error total is a number
    const total: string = result.total;
    void total;
  });
});

test('the names of the methods are in the URL for the network panel, each once', async () => {
  const { fetch, sent } = server(() => 1);
  const rpc = new RpcClient('/rpc', { fetch });
  await Promise.all([rpc.call('task.read'), rpc.call('comment.list'), rpc.call('task.read')]);
  await rpc.call('user.me');
  expect(sent.map(request => request.url)).toEqual(['/rpc?task.read,comment.list', '/rpc?user.me']);

  const plain = server(() => 1);
  await new RpcClient('/api/rpc?v=2', { fetch: plain.fetch }).call('a.b');
  await new RpcClient('/rpc', { fetch: plain.fetch, methodsInUrl: false }).call('a.b');
  expect(plain.sent.map(request => request.url)).toEqual(['/api/rpc?v=2&a.b', '/rpc']);
});
