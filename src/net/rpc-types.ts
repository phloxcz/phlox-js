#!/usr/bin/env node
/**
 * Writes TypeScript types for an RPC endpoint from its OpenRPC document. In an application with the package:
 *
 *   npx phlox-rpc-types <url or file> <output.ts> [--class RpcApi] [--import @phloxcz/phlox-js/net]
 *   npx phlox-rpc-types http://localhost:9079/rpc/openrpc.json src/api/rpc.ts
 *
 * In this repository: node src/net/rpc-types.ts …, or npm run rpc:types -- ….
 */

/// <reference types="node" />
import { readFile, writeFile } from 'node:fs/promises';
import { generateRpcTypes } from './openrpc.ts';

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args.splice(index, 2)[1];
};
const className = option('--class');
const importFrom = option('--import');
const [source, output] = args;

if (!source || !output) {
  console.error('Usage: phlox-rpc-types <url or file> <output.ts> [--class RpcApi] [--import @phloxcz/phlox-js/net]');
  process.exit(1);
}

const text = /^https?:\/\//.test(source)
  ? await fetch(source).then(response => {
    if (!response.ok) throw new Error(`${source}: HTTP ${response.status}. Is the document exposed (debug mode or documentation.expose)?`);
    return response.text();
  })
  : await readFile(source, 'utf8');

await writeFile(output, generateRpcTypes(JSON.parse(text), {
  ...(className ? { className } : {}),
  ...(importFrom ? { importFrom } : {}),
}));
console.log(`Written ${output}`);
