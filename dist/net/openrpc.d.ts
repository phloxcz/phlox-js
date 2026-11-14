/**
 * Generates TypeScript types from an OpenRPC document, as phloxcz/rpc-api publishes it at /rpc/openrpc.json.
 * It has no imports, so the command line script can run it in Node directly.
 */
interface Schema {
    $ref?: string;
    type?: string | string[];
    enum?: unknown[];
    const?: unknown;
    anyOf?: Schema[];
    oneOf?: Schema[];
    allOf?: Schema[];
    items?: Schema;
    properties?: Record<string, Schema>;
    required?: string[];
    additionalProperties?: boolean | Schema;
    description?: string;
    format?: string;
}
interface Method {
    name: string;
    summary?: string;
    description?: string;
    deprecated?: boolean;
    params?: {
        name: string;
        required?: boolean;
        schema?: Schema;
        description?: string;
    }[];
    result?: {
        schema?: Schema;
        description?: string;
    };
    'x-authorize'?: boolean;
    'x-roles'?: string[][];
}
export interface OpenRpcDocument {
    info?: {
        title?: string;
        version?: string;
    };
    methods: Method[];
    components?: {
        schemas?: Record<string, Schema>;
    };
}
export interface GenerateOptions {
    /** Name of the generated client class, `RpcApi` by default. */
    className?: string;
    /** Where the client is imported from, `phlox-js/net` by default. */
    importFrom?: string;
}
/** Returns the content of a TypeScript file with the types of the document and a typed client class. */
export declare function generateRpcTypes(document: OpenRpcDocument, options?: GenerateOptions): string;
export {};
