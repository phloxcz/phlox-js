/**
 * The mock backend of the helpdesk as a plugin of the Vite dev server: JSON-RPC 2.0 at /helpdesk/rpc,
 * the same protocol as phlox-rpc-api (batches, errors with `fields`, 401 without a token), and downloads
 * of attachments at /helpdesk/files/<id>/<name>. The data are in memory and start again with the server.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { ApiError, db, methods, tokens } from './methods.ts';

interface Request {
  jsonrpc?: string;
  method?: string;
  params?: object;
  id?: number | string | null;
}

/** Like a real server on a network: answers take a while. */
const LATENCY = 200;

function read(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function call(request: Request, me: number | undefined): object | null {
  const id = request.id ?? null;
  const fail = (code: number, message: string, fields?: Record<string, string>) =>
    ({ jsonrpc: '2.0', id, error: { code, message, ...(fields ? { fields } : {}) } });
  if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') return fail(-32600, 'Invalid Request');
  const handler = (methods as Record<string, (params: object, me: number) => unknown>)[request.method];
  if (!handler) return fail(-32601, 'Method not found');
  if (request.method !== 'sign.in' && me === undefined) return fail(401, 'Unauthorized');
  try {
    const result = handler(request.params ?? {}, me ?? 0);
    return request.id === undefined ? null : { jsonrpc: '2.0', id, result };
  } catch (error) {
    if (error instanceof ApiError) return fail(error.code, error.message, error.fields);
    console.error(error);
    return fail(-32603, 'Internal error');
  }
}

async function rpc(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const token = /^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1];
  const me = token ? tokens.get(token) : undefined;
  let body: Request | Request[];
  try {
    body = JSON.parse(await read(request));
  } catch {
    body = [];
  }
  await new Promise(resolve => setTimeout(resolve, LATENCY));
  const answers = (Array.isArray(body) ? body : [body]).map(item => call(item, me)).filter(answer => answer !== null);
  if (!answers.length) {
    response.statusCode = 204;
    response.end();
    return;
  }
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(Array.isArray(body) ? answers : answers[0]));
}

function file(id: number, response: ServerResponse): void {
  const found = db.attachments.find(item => item.id === id);
  if (!found) {
    response.statusCode = 404;
    response.end('Not found');
    return;
  }
  response.setHeader('Content-Type', found.type);
  response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(found.name)}`);
  response.end(found.content);
}

export function helpdeskServer(): Plugin {
  return {
    name: 'helpdesk-server',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0]!;
        if (path === '/helpdesk/rpc' && request.method === 'POST') return void rpc(request, response);
        const download = /^\/helpdesk\/files\/(\d+)\//.exec(path);
        if (download && request.method === 'GET') return file(Number(download[1]), response);
        next();
      });
    },
  };
}
