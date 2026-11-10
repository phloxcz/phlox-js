/**
 * Writes TypeScript types for an RPC endpoint from its OpenRPC document.
 *
 *   node src/net/rpc-types.ts <url or file> <output.ts> [--class RpcApi] [--import phlox-js/net]
 *   node src/net/rpc-types.ts http://localhost:9079/rpc/openrpc.json src/api/rpc.ts
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
  console.error('Usage: node src/net/rpc-types.ts <url or file> <output.ts> [--class RpcApi] [--import phlox-js/net]');
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
