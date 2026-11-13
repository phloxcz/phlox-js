/**
 * The mock backend of the helpdesk as a plugin of the Vite dev server: JSON-RPC 2.0 at /helpdesk/rpc,
 * the same protocol as phlox-rpc-api (batches, errors with `fields`, 401 without a token), and downloads
 * of attachments at /helpdesk/files/<id>/<name>. The data are in memory and start again with the server.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { Buffer } from 'node:buffer';
import { db } from './methods.ts';
import { helpdeskMock } from './mock.ts';

/** Like a real server on a network: answers take a while. */
const mock = helpdeskMock(200);

function read(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

async function rpc(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const answer = await mock.handle(await read(request), request.headers as Record<string, string>);
  if (answer === null) {
    response.statusCode = 204;
    response.end();
    return;
  }
  response.setHeader('Content-Type', 'application/json');
  response.end(answer);
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
