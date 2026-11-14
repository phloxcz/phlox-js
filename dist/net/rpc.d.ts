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
export declare const RpcErrorCode: {
    readonly ParseError: -32700;
    readonly InvalidRequest: -32600;
    readonly MethodNotFound: -32601;
    readonly InvalidParams: -32602;
    readonly InternalError: -32603;
    /** Not logged in. */
    readonly Unauthorized: 401;
    /** Logged in, but without the role. */
    readonly Forbidden: 403;
    /** The request did not reach the server or no answer came back. */
    readonly Network: 0;
};
export declare class RpcError extends Error {
    readonly code: number;
    readonly data: Record<string, unknown>;
    readonly method: string;
    /**
     * @param code Error code from the server, an HTTP status when the HTTP request failed, 0 for a network error
     * @param data Other members of the error object, e.g. `fields` with invalid parameters
     */
    constructor(code: number, message: string, data?: Record<string, unknown>, method?: string);
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
    offline?: {
        handles(method: string): boolean;
        attach(send: (method: string, params?: object) => Promise<unknown>): void;
        call(method: string, params: unknown): Promise<unknown>;
    };
    fetch?: typeof fetch;
}
/** With every parameter optional, the parameters may be left out. */
type ParamsArgs<P> = {} extends P ? [params?: P] : [params: P];
export declare class RpcClient<M extends {
    [K in keyof M]: RpcMethod;
} = Record<string, {
    params: any;
    result: any;
}>> {
    readonly url: string;
    private options;
    private queue;
    private lastId;
    constructor(url: string, options?: RpcOptions);
    /** Calls a method and returns its result, or rejects with RpcError. */
    call<K extends keyof M & string>(method: K, ...[params]: ParamsArgs<M[K]['params']>): Promise<M[K]['result']>;
    /** A call over the network, without the offline layer. */
    private request;
    /** Calls a method without waiting for its result. The server answers nothing, not even an error. */
    notify<K extends keyof M & string>(method: K, ...[params]: ParamsArgs<M[K]['params']>): Promise<void>;
    private enqueue;
    /** The URL with the names of the methods, each once, in the order of the calls. */
    private urlFor;
    private send;
}
export {};
