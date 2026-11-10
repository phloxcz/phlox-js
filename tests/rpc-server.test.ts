// @vitest-environment node
/**
 * Against a running phlox-api-sample. Skipped unless PHLOX_RPC_URL is set:
 *   (in phlox-api-sample) php -S 127.0.0.1:9079 -t www/
 *   (here) $env:PHLOX_RPC_URL = 'http://127.0.0.1:9079/rpc'; npx vitest run tests/rpc-server.test.ts
 */
import { describe, expect, test } from 'vitest';
import { RpcError, RpcErrorCode } from '../src/net/index';
import { generateRpcTypes } from '../src/net/openrpc';
import { SampleApi } from './fixtures/sample-rpc';

const url = process.env.PHLOX_RPC_URL;

describe.skipIf(!url)('phlox-api-sample', () => {
  const api = new SampleApi(url!);

  test('stats.tasks returns a page of tasks', async () => {
    const page = await api.call('stats.tasks', { query: { pageSize: 2, sort: [{ field: 'id', dir: 'asc' }] } });
    expect(page.page).toBe(1);
    expect(page.data.length).toBeLessThanOrEqual(2);
    expect(typeof page.total).toBe('number');
  });

  test('calls at the same time go as one batch and each gets its result', async () => {
    const [first, second] = await Promise.all([
      api.call('stats.tasks', { query: { pageSize: 1, page: 1 } }),
      api.call('stats.tasks', { query: { pageSize: 1, page: 2 } }),
    ]);
    expect(first.page).toBe(1);
    expect(second.page).toBe(2);
  });

  test('errors of the server become RpcError', async () => {
    const untyped = api as unknown as { call(method: string, params?: object): Promise<unknown> };
    const missing = await untyped.call('stats.nothing').catch((error: RpcError) => error);
    expect(missing).toBeInstanceOf(RpcError);
    expect((missing as RpcError).code).toBe(RpcErrorCode.MethodNotFound);

    const invalid = await untyped.call('stats.tasks', { query: { page: 'first' } }).catch((error: RpcError) => error);
    expect(invalid).toBeInstanceOf(RpcError);
    expect((invalid as RpcError).code).toBe(RpcErrorCode.InvalidParams);
  });

  test('the published document generates the committed types', async () => {
    const response = await fetch(`${url}/openrpc.json`);
    expect(response.ok).toBe(true);
    const generated = generateRpcTypes(await response.json(), { className: 'SampleApi', importFrom: '../../src/net/index' });
    const { readFileSync } = await import('node:fs');
    expect(generated).toBe(readFileSync('tests/fixtures/sample-rpc.ts', 'utf8').replaceAll('\r\n', '\n'));
  });
});
