#!/usr/bin/env node
import { generateRpcTypes } from "./openrpc.js";
import { readFile, writeFile } from "node:fs/promises";
// src/net/rpc-types.ts
/**
* Writes TypeScript types for an RPC endpoint from its OpenRPC document. In an application with the package:
*
*   npx phlox-rpc-types <url or file> <output.ts> [--class RpcApi] [--import phlox-js/net]
*   npx phlox-rpc-types http://localhost:9079/rpc/openrpc.json src/api/rpc.ts
*
* In this repository: node src/net/rpc-types.ts …, or npm run rpc:types -- ….
*/
var args = process.argv.slice(2);
var option = (name) => {
	const index = args.indexOf(name);
	return index < 0 ? void 0 : args.splice(index, 2)[1];
};
var className = option("--class");
var importFrom = option("--import");
var [source, output] = args;
if (!source || !output) {
	console.error("Usage: phlox-rpc-types <url or file> <output.ts> [--class RpcApi] [--import phlox-js/net]");
	process.exit(1);
}
var text = /^https?:\/\//.test(source) ? await fetch(source).then((response) => {
	if (!response.ok) throw new Error(`${source}: HTTP ${response.status}. Is the document exposed (debug mode or documentation.expose)?`);
	return response.text();
}) : await readFile(source, "utf8");
await writeFile(output, generateRpcTypes(JSON.parse(text), {
	...className ? { className } : {},
	...importFrom ? { importFrom } : {}
}));
console.log(`Written ${output}`);
