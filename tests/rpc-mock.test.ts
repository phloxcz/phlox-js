import { describe, expect, test } from 'vitest';
import { RpcClient, RpcError, RpcMockError, createRpcMock } from '../src/net/index';

interface Methods {
  'task.read': { params: { id: number }; result: { id: number; name: string } };
  'task.save': { params: { name: string }; result: null };
  'me.name': { params: Record<string, never>; result: string };
}

describe('createRpcMock', () => {
  test('answers RpcClient by the table: results, batches, errors with fields, the calls', async () => {
    const mock = createRpcMock<Methods>({
      'task.read': ({ id }) => ({ id, name: `Úkol ${id}` }),
      'task.save': ({ name }) => {
        if (!name) throw new RpcMockError(-32602, 'Invalid params', { 'name': 'Vyplňte název.' });
        return null;
      },
    });
    const api = new RpcClient<Methods>('/rpc', { fetch: mock.fetch });

    const [first, second] = await Promise.all([api.call('task.read', { id: 1 }), api.call('task.read', { id: 2 })]);
    expect(first.name).toBe('Úkol 1');
    expect(second.name).toBe('Úkol 2');

    const invalid = await api.call('task.save', { name: '' }).catch((error: RpcError) => error);
    expect(invalid).toBeInstanceOf(RpcError);
    expect((invalid as RpcError).code).toBe(-32602);
    expect((invalid as RpcError).data.fields).toEqual({ name: 'Vyplňte název.' });

    const missing = await api.call('me.name').catch((error: RpcError) => error);
    expect((missing as RpcError).code).toBe(-32601);
    expect(mock.calls.map(call => call.method)).toEqual(['task.read', 'task.read', 'task.save']);
  });

  test('the context from the headers, e.g. the user by the token; handle() for a server', async () => {
    const mock = createRpcMock<Methods, string | null>({
      'me.name': (_params, user) => {
        if (!user) throw new RpcMockError(401, 'Unauthorized');
        return user;
      },
    }, { context: headers => headers.authorization?.replace('Bearer ', '') ?? null });

    const signedIn = new RpcClient<Methods>('/rpc', { fetch: mock.fetch, headers: () => ({ Authorization: 'Bearer Jana' }) });
    expect(await signedIn.call('me.name')).toBe('Jana');
    const guest = new RpcClient<Methods>('/rpc', { fetch: mock.fetch });
    expect(await guest.call('me.name').catch((error: RpcError) => error.code)).toBe(401);

    expect(await mock.handle('{"jsonrpc":"2.0","method":"me.name"}')).toBeNull();
    expect(JSON.parse((await mock.handle('nonsense'))!).error.code).toBe(-32700);
  });
});
