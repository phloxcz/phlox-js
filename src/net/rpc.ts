/**
 * JSON-RPC 2.0 client for phloxcz/rpc-api.
 * Calls made in the same moment (one tick) go to the server as one batch request.
 */

/** Parameters and result of one method. Generated from OpenRPC by `rpc-types`, see docs/guide.md. */
export interface RpcMethod {
  params: object;
  result: unknown;
}

export type RpcMethods = Record<string, RpcMethod>;

/** Codes of protocol errors, the same as ProtocolError in phloxcz/api-core. */
export const RpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  /** Not logged in. */
  Unauthorized: 401,
  /** Logged in, but without the role. */
  Forbidden: 403,
  /** The request did not reach the server or no answer came back. */
  Network: 0,
} as const;

export class RpcError extends Error {
  /**
   * @param code Error code from the server, an HTTP status when the HTTP request failed, 0 for a network error
   * @param data Other members of the error object, e.g. `fields` with invalid parameters
   */
  constructor(readonly code: number, message: string, readonly data: Record<string, unknown> = {}, readonly method = '') {
    super(method ? `${method}: ${message}` : message);
    this.name = 'RpcError';
  }
}

export interface RpcOptions {
  /** Headers of every request, e.g. `Authorization`. A function, so it can read the current token. */
  headers?: () => Record<string, string>;
  /** `include` sends cookies to another origin, for a session instead of a token. */
  credentials?: RequestCredentials;
  /** Calls made at the same time go as one request. On by default. */
  batch?: boolean;
  /**
   * Names of the called methods go to the query of the URL (`/rpc?task.read,comment.list`), so the network
   * panel of the browser shows what each request calls. The server ignores them. On by default.
   */
  methodsInUrl?: boolean;
  /** Working offline: kept results of reading methods and a queue of writing ones, see RpcOffline. */
  offline?: { handles(method: string): boolean; attach(send: (method: string, params?: object) => Promise<unknown>): void; call(method: string, params: unknown): Promise<unknown> };
  fetch?: typeof fetch;
}

interface Pending {
  method: string;
  params: object | undefined;
  id: number | undefined;
  resolve: (result: any) => void;
  reject: (error: unknown) => void;
}

interface Response {
  id?: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; [key: string]: unknown };
}

/** With every parameter optional, the parameters may be left out. */
type ParamsArgs<P> = {} extends P ? [params?: P] : [params: P];

export class RpcClient<M extends { [K in keyof M]: RpcMethod } = Record<string, { params: any; result: any }>> {
  private queue: Pending[] = [];
  private lastId = 0;

  constructor(readonly url: string, private options: RpcOptions = {}) {
    options.offline?.attach((method, params) => this.request(method, params));
  }

  /** Calls a method and returns its result, or rejects with RpcError. */
  call<K extends keyof M & string>(method: K, ...[params]: ParamsArgs<M[K]['params']>): Promise<M[K]['result']> {
    const offline = this.options.offline;
    if (offline?.handles(method)) return offline.call(method, params) as Promise<M[K]['result']>;
    return this.request(method, params);
  }

  /** A call over the network, without the offline layer. */
  private request(method: string, params: object | undefined): Promise<any> {
    return new Promise((resolve, reject) => this.enqueue({ method, params, id: ++this.lastId, resolve, reject }));
  }

  /** Calls a method without waiting for its result. The server answers nothing, not even an error. */
  notify<K extends keyof M & string>(method: K, ...[params]: ParamsArgs<M[K]['params']>): Promise<void> {
    return new Promise((resolve, reject) => this.enqueue({ method, params, id: undefined, resolve, reject }));
  }

  private enqueue(call: Pending): void {
    if (this.options.batch === false) {
      void this.send([call]);
      return;
    }
    this.queue.push(call);
    if (this.queue.length === 1) queueMicrotask(() => void this.send(this.queue.splice(0)));
  }

  /** The URL with the names of the methods, each once, in the order of the calls. */
  private urlFor(calls: Pending[]): string {
    if (this.options.methodsInUrl === false) return this.url;
    const names = [...new Set(calls.map(call => encodeURIComponent(call.method)))].join(',');
    return `${this.url}${this.url.includes('?') ? '&' : '?'}${names}`;
  }

  private async send(calls: Pending[]): Promise<void> {
    const requests = calls.map(call => ({
      jsonrpc: '2.0',
      method: call.method,
      ...(call.params === undefined ? {} : { params: call.params }),
      ...(call.id === undefined ? {} : { id: call.id }),
    }));
    const failAll = (error: RpcError) => calls.forEach(call => call.reject(error));

    let body: Response | Response[] | null;
    try {
      const response = await (this.options.fetch ?? fetch)(this.urlFor(calls), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...this.options.headers?.() },
        body: JSON.stringify(requests.length === 1 ? requests[0] : requests),
        ...(this.options.credentials ? { credentials: this.options.credentials } : {}),
      });
      if (!response.ok) return failAll(new RpcError(response.status, `HTTP ${response.status} ${response.statusText}`.trim()));
      body = response.status === 204 ? null : await response.json();
    } catch (error) {
      return failAll(new RpcError(RpcErrorCode.Network, `Network error: ${error instanceof Error ? error.message : String(error)}`));
    }

    const responses = body === null ? [] : Array.isArray(body) ? body : [body];
    const byId = new Map(responses.map(response => [response.id, response]));
    // An error without id concerns the whole request, e.g. a batch that is too large
    const general = responses.find(response => response.error && (response.id === null || response.id === undefined));

    for (const call of calls) {
      if (call.id === undefined) {
        call.resolve(undefined);
        continue;
      }
      const response = byId.get(call.id) ?? general;
      if (!response) {
        call.reject(new RpcError(RpcErrorCode.InternalError, 'The server sent no response to the call.', {}, call.method));
      } else if (response.error) {
        const { code, message, ...data } = response.error;
        call.reject(new RpcError(code, message, data, call.method));
      } else {
        call.resolve(response.result);
      }
    }
  }
}
