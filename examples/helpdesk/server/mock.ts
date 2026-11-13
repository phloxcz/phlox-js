// The mock server of the helpdesk as one object: the same for the dev server of Vite (plugin.ts) and for tests.
import { RpcMockError, createRpcMock } from '../../../src/net/mock.ts';
import type { RpcHandlers, RpcMock } from '../../../src/net/mock.ts';
import type { RpcMethods } from '../api.ts';
import { methods, tokens } from './methods.ts';

/** Every method but sign.in needs the token of a logged-in user, like #[Authorize] in phlox-rpc-api. */
export function helpdeskMock(latency = 0): RpcMock {
  const table = methods as Record<string, (params: object, me: number) => unknown>;
  const handlers = Object.fromEntries(Object.entries(table).map(([name, handler]) => [
    name,
    name === 'sign.in' ? handler : (params: object, me: number | undefined) => {
      if (me === undefined) throw new RpcMockError(401, 'Unauthorized');
      return handler(params, me);
    },
  ]));
  // The context is the id of the user by the token, undefined without one
  return createRpcMock<RpcMethods, number | undefined>(handlers as RpcHandlers<RpcMethods, number | undefined>, {
    latency,
    context: headers => {
      const token = /^Bearer (.+)$/.exec(headers.authorization ?? '')?.[1];
      return token ? tokens.get(token) : undefined;
    },
  });
}
