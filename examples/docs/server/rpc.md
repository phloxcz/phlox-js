# Volání serveru: RPC

Klient pro JSON-RPC 2.0, na druhé straně je [phloxcz/rpc-api](https://github.com/phloxcz/rpc-api). Importuje se z `@phloxcz/phlox-js/net`.

## Typy z PHP

Server publikuje popis svých metod (dokument OpenRPC) na `/rpc/openrpc.json`. Ve výchozím stavu jen v debug režimu, viz `documentation.expose` v README `phlox-rpc-api`. Z něj se vygenerují typy:

```bash
npm run rpc:types -- http://localhost:9079/rpc/openrpc.json src/api/rpc.ts
npm run rpc:types -- api.json src/api/rpc.ts --class ShopApi    # ze souboru a s jiným názvem třídy
```

Vznikne soubor s rozhraními DTO, s popisem všech metod a s třídou `RpcApi`. Ručně se neupravuje, po změně API se vygeneruje znovu.

## Použití

```ts
// services.ts
import { RpcApi } from './api/rpc';

export const services = new Container();
services.add(new RpcApi('/rpc', {
  headers: () => {
    const token = services.get(User).token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
}));
```

```ts
class TasksPresenter extends Presenter {
  tasks = state<TaskResource[]>([]);

  constructor(private api: RpcApi) {
    super();
  }

  override async startup() {
    const page = await this.api.call('stats.tasks', { query: { pageSize: 20, sort: [{ field: 'dueDate' }] } });
    this.tasks.set(page.data);
  }
}
```

<!-- demo: rpc-mock -->

- **Kompilátor hlídá** název metody, parametry i typ výsledku. Překlep v `'stats.task'` nebo `sort: [{ field: 'title' }]` je chyba kompilace.
- **Parametry jsou pojmenované,** jako v PHP metodě. Když jsou všechny nepovinné, dají se vynechat: `this.api.call('stats.tasks')`.
- **Data a časy přijdou jako text,** JSON jiný typ nezná. U pole s formátem `date` nebo `date-time` to říká komentář ve vygenerovaném souboru.
- **Dávky jsou automatické:** volání ve stejném okamžiku, třeba přes `Promise.all`, odejdou na server jedním požadavkem. Vypíná se volbou `batch: false`.
- **`notify()`** zavolá metodu bez výsledku. Server neodpoví nic, ani chybu, prázdnou odpovědí se stavem 204 nebo 200. Vrácený promise se splní po odeslání, takže `await this.api.notify('user.logout')` počká, než volání odejde (třeba s tokenem, který se pak smaže).
- **Session místo tokenu:** `new RpcApi('/rpc', { credentials: 'include' })`, prohlížeč pak posílá cookies i na jiný původ.
- **Bez typů** jde použít přímo `new RpcClient('/rpc')`, `call()` pak bere libovolnou metodu a vrací `any`.
- **Názvy metod v URL:** požadavek jde na `/rpc?task.read,comment.list`, takže je v záložce Síť v prohlížeči vidět, co volá (u dávky každá metoda jednou). Server query ignoruje. Vypíná se volbou `methodsInUrl: false`.

## Soubory přes RPC

JSON-RPC přenáší jen text. `fileChunks(file, size)` z `@phloxcz/phlox-js/net` přečte soubor po částech (výchozí 1 MB) a každou vrátí v base64, takže velký soubor nikdy není v paměti celý:

```ts
for await (const chunk of fileChunks(file)) {
  // chunk: { index, total, offset, data }, prázdný soubor má jednu prázdnou část
  await this.api.call('file.chunk', { uploadId, ...chunk });
}
```

Base64 je o třetinu větší než soubor. Na velké soubory je lepší REST API: `fetch(url, { method: 'PUT', body: file })` pošle soubor proudem.

## Mock server

`createRpcMock` z `@phloxcz/phlox-js/net` je falešný server z tabulky metod, pro testy i pro vývoj bez backendu, viz Testování aplikací.

## Chyby

Každé selhání je `RpcError` s `code`, `message`, `method` a `data`. Nepovedené volání v dávce neovlivní ostatní.

| `code` | Kdy |
|---|---|
| `401`, `403` | nepřihlášený uživatel, chybějící role |
| `-32602` | neplatné parametry, podrobnosti v `error.data.fields` |
| `-32601` | metoda neexistuje |
| kód z `ApiException` | chyba aplikace na serveru |
| HTTP stav | server odpověděl chybou HTTP |
| `0` | požadavek nedošel nebo nepřišla odpověď |

Konstanty jsou v `RpcErrorCode`. Odhlášení po vypršení tokenu jde vyřešit na jednom místě:

```ts
app.onError = error => {
  if (error instanceof RpcError && error.code === RpcErrorCode.Unauthorized) {
    app.user.logout();
    void app.router.navigate('/sign/in');
    return;
  }
  app.flashes.add(String(error), 'error');
};
```
