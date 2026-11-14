# Testování aplikací

Pomocníci pro testy aplikací jsou v `phlox-js/testing`, mock serveru RPC v `phlox-js/net`. Fungují s každým nástrojem, který má DOM, typicky Vitest s jsdom.

```ts
import { afterEach, expect, test } from 'vitest';
import { bootApp, cleanup, until } from 'phlox-js/testing';
import { createRpcMock } from 'phlox-js/net';

afterEach(cleanup);

test('detail úkolu', async () => {
  const server = createRpcMock<RpcMethods>({
    'task.read': ({ id }) => ({ id, name: 'Opravit export' }),
  });
  const { element, errors, go } = await bootApp(AppPresenter, { url: '/tasks', services: createServices({ fetch: server.fetch }) });
  await go('/tasks/5');
  await until(() => element.querySelector('h1')?.textContent === 'Opravit export');
  expect(server.calls).toEqual([{ method: 'task.read', params: { id: 5 } }]);
  expect(errors).toEqual([]);
});
```

- **`bootApp(root, { url, services, basePath })`** spustí aplikaci se skutečnými presentery. Vrátí `app`, `element`, `go(url)` a `errors`, kam místo konzole jdou chyby aplikace. **`cleanup()`** všechny zastaví a vyprázdní stránku, patří do `afterEach`.
- **`until(podmínka)`** počká, až se třeba ukážou data. **`tick()`** nechá proběhnout časovače a události, **`type(pole, text)`** a **`press(prvek, 'Enter')`** píšou a mačkají jako uživatel.
- **Služby jako funkce:** `createServices(options)` místo hotového kontejneru, aby test dostal stejné služby jako aplikace, jen s jiným `fetch` (nebo s falešnou službou místo skutečné). Viz `examples/helpdesk/services.ts`.
- **`createRpcMock<RpcMethods>(metody, { context, latency })`** odpovídá jako `phlox-rpc-api`: dávky, chyby, notifikace. Chybu pošle `throw new RpcMockError(kód, zpráva, fields)`, `-32602` s `fields` ukáže formulář u polí. `context` z hlaviček udělá třeba přihlášeného uživatele. `fetch` je pro `RpcClient`, `handle(body, headers)` pro server, třeba plugin Vite.
- **Jedna tabulka metod pro vývoj i testy:** helpdesk má mock server ve Vite i v testu (`tests/helpdesk.test.tsx`) z jedné `helpdeskMock()`.
