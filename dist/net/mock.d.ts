/**
 * A mock JSON-RPC server: a table of methods answers like phlox-rpc-api (batches, errors with `fields`,
 * notifications). The same table serves tests (`fetch` for RpcClient) and a dev server (`handle` for Vite):
 *
 *   const server = createRpcMock<RpcMethods>({ 'task.read': ({ id }) => tasks.find(task => task.id === id)! });
 *   const api = new RpcApi('/rpc', { fetch: server.fetch });
 */
import type { RpcMethod } from './rpc.js';
/** An error the mock sends back, like ApiException or invalid parameters (code -32602 with `fields`) in phlox-api-core. */
export declare class RpcMockError extends Error {
    readonly code: number;
    readonly fields?: Record<string, string> | undefined;
    constructor(code: number, message: string, fields?: Record<string, string> | undefined);
}
/** Methods of the mock: parameters and the context (e.g. the logged-in user from a header) to the result. */
export type RpcHandlers<M extends {
    [K in keyof M]: RpcMethod;
}, C> = {
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
    calls: {
        method: string;
        params: unknown;
    }[];
}
export declare function createRpcMock<M extends {
    [K in keyof M]: RpcMethod;
}, C = undefined>(handlers: RpcHandlers<M, C>, options?: RpcMockOptions<C>): RpcMock;
