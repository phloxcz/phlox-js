/**
 * A mock JSON-RPC server: a table of methods answers like phlox-rpc-api (batches, errors with `fields`,
 * notifications). The same table serves tests (`fetch` for RpcClient) and a dev server (`handle` for Vite):
 *
 *   const server = createRpcMock<RpcMethods>({ 'task.read': ({ id }) => tasks.find(task => task.id === id)! });
 *   const api = new RpcApi('/rpc', { fetch: server.fetch });
 */

import type { RpcMethod } from './rpc';

/** An error the mock sends back, like ApiException or invalid parameters (code -32602 with `fields`) in phlox-api-core. */
export class RpcMockError extends Error {
  constructor(readonly code: number, message: string, readonly fields?: Record<string, string>) {
    super(message);
    this.name = 'RpcMockError';
  }
}

/** Methods of the mock: parameters and the context (e.g. the logged-in user from a header) to the result. */
export type RpcHandlers<M extends { [K in keyof M]: RpcMethod }, C> = {
  [K in keyof M]?: (params: M[K]['params'], context: C) => M[K]['result'] | Promise<M[K]['result']>;
};

export interface RpcMockOptions<C> {
  /** The context of a request from its headers, e.g. the user by the token in `authorization`. */
  context?: (headers: Record<string, string>) => C;
  /** How long an answer takes in ms, like a real network. 0 by default. */
  latency?: number;
}

export interface RpcMock {
  /** A fetch for RpcClient: `new RpcApi('/rpc', { fetch: mock.fetch })`. */
  fetch: typeof fetch;
  /** Answers the body of a request, null for no answer (only notifications). For a server, e.g. a plugin of Vite. */
  handle(body: string, headers?: Record<string, string>): Promise<string | null>;
  /** Every call so far, for checks in tests. */
  calls: { method: string; params: unknown }[];
}

interface Request {
  jsonrpc?: string;
  method?: string;
  params?: object;
  id?: number | string | null;
}

export function createRpcMock<M extends { [K in keyof M]: RpcMethod }, C = undefined>(
  handlers: RpcHandlers<M, C>, options: RpcMockOptions<C> = {},
): RpcMock {
  const calls: RpcMock['calls'] = [];
  const table = handlers as Record<string, ((params: object, context: C) => unknown) | undefined>;

  const answer = async (request: Request, context: C): Promise<object | null> => {
    const id = request.id ?? null;
    const fail = (code: number, message: string, fields?: Record<string, string>) =>
      ({ jsonrpc: '2.0', id, error: { code, message, ...(fields ? { fields } : {}) } });
    if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') return fail(-32600, 'Invalid Request');
    const handler = table[request.method];
    // A notification (no id) gets no answer, not even an error
    const notification = request.id === undefined;
    if (!handler) return notification ? null : fail(-32601, 'Method not found');
    calls.push({ method: request.method, params: request.params });
    try {
      const result = await handler(request.params ?? {}, context);
      return notification ? null : { jsonrpc: '2.0', id, result: result ?? null };
    } catch (error) {
      if (!(error instanceof RpcMockError)) console.error(error);
      if (notification) return null;
      return error instanceof RpcMockError ? fail(error.code, error.message, error.fields) : fail(-32603, 'Internal error');
    }
  };

  const handle = async (body: string, headers: Record<string, string> = {}): Promise<string | null> => {
    let parsed: Request | Request[];
    try {
      parsed = JSON.parse(body);
    } catch {
      return JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }
    if (options.latency) await new Promise(resolve => setTimeout(resolve, options.latency));
    const context = options.context ? options.context(headers) : (undefined as C);
    const answers = (await Promise.all((Array.isArray(parsed) ? parsed : [parsed]).map(request => answer(request, context))))
      .filter(item => item !== null);
    if (!answers.length) return null;
    return JSON.stringify(Array.isArray(parsed) ? answers : answers[0]);
  };

  const fetch = (async (_input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([name, value]) => [name.toLowerCase(), value]));
    const text = await handle(String(init.body ?? ''), headers);
    return text === null
      ? new Response(null, { status: 204 })
      : new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof globalThis.fetch;

  return { fetch, handle, calls };
}
