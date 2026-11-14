#!/usr/bin/env node
/**
 * Writes TypeScript types for an RPC endpoint from its OpenRPC document. In an application with the package:
 *
 *   npx phlox-rpc-types <url or file> <output.ts> [--class RpcApi] [--import phlox-js/net]
 *   npx phlox-rpc-types http://localhost:9079/rpc/openrpc.json src/api/rpc.ts
 *
 * In this repository: node src/net/rpc-types.ts …, or npm run rpc:types -- ….
 */
export {};
