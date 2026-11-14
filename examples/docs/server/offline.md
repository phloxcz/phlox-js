# Práce offline

Aplikace může pracovat bez signálu: data, která uživatel otevřel nebo si připravil, má k dispozici, a co udělá, odešle se po návratu signálu. Celé je to vidět v helpdesku (tlačítko „Připravit pro offline“ u seznamu úkolů).

```ts
import { IndexedDbStore, RpcOffline } from 'phlox-js/net';

class AppOffline extends RpcOffline<RpcMethods> {}     // vlastní třída, aby ji služby našly podle typu

const offline = new AppOffline(new IndexedDbStore('moje-aplikace'), {
  reads: {
    'task.read': {},                                   // výsledek se ukládá a offline vrací
    'task.list': { offline: async ({ query }, cache) => filtruj((await cache.all('task.read')).map(e => e.value), query) },
  },
  writes: {
    'task.update': {
      apply: async ({ id, input }, cache) => {          // promítne změnu do uložených dat, vrátí výsledek
        const task = { ...(await cache.get('task.read', { id })), ...input };
        await cache.set('task.read', { id }, task);
        return task;
      },
      version: async ({ id }, cache) => (await cache.get('task.read', { id }))?.updated,
      current: async ({ id }, call) => (await call('task.read', { id })).updated,
      describe: ({ id }) => `Změna úkolu ${id}`,
    },
  },
}, () => String(user.getId()));                        // data a fronta patří přihlášenému uživateli

services.add(offline, new RpcApi('/rpc', { offline }));
```

<!-- demo: offline-queue -->

- **Čtení:** každá metoda z `reads` se online volá normálně a výsledek se uloží. Offline (nebo při chybě sítě) se vrátí uložený. Když tentýž dotaz uložený není, zkusí se `offline`, který odpověď spočítá z jiných uložených dat, třeba seznam s jiným filtrem z uložených úkolů. Jinak chyba sítě (`RpcError` s kódem 0).
- **Zápis:** metoda z `writes` jde online rovnou na server. Offline se uloží do fronty a vrátí výsledek z `apply`, takže obrazovky změnu ukážou hned.
- **Příprava pro offline:** `await offline.download([['project.list'], ['task.read', { id: 5 }], …])` stáhne a uloží data dopředu, volání jdou jednou dávkou. `offline.downloaded()` je čas poslední přípravy.
- **Odeslání:** samo po návratu signálu a ručně `offline.sync()`. Fronta je v IndexedDB, přežije zavření aplikace. `offline.onSynced(() => app.invalidate('tasks'))` načte obrazovky znovu.
- **Záznam změněný mezitím:** s `version` a `current` se před odesláním porovná verze záznamu (třeba čas poslední změny) s tou na serveru. Liší-li se, změna čeká v `offline.conflicts()` a aplikace se zeptá; `offline.resolve(změna, 'send' | 'drop')`.
- **Odmítnuté změny** (validace, oprávnění) jsou v `offline.failed()` s důvodem: `offline.retry(změna)`, `offline.drop(změna)`. Čekající v `offline.pending()`, průběh v `offline.syncing()`. Vše je `state`, takže jde rovnou do šablony.
- **`online()`** z `phlox-js/net` je stav připojení: `<If when={() => !online()}>Offline</If>`.
- **Testy** dostanou `MemoryStore` místo `IndexedDbStore` (jsdom IndexedDB nemá).
- **Kostra aplikace offline (PWA):** `vite-plugin-pwa` v konfiguraci Vite uloží stránku, JS a CSS do service workeru. V helpdesku je nastavení v `examples/vite.config.ts` a registrace s nabídkou nové verze v `examples/helpdesk/main.ts`. Funguje v sestavené verzi (`npm run build:examples`, pak `npx vite preview --config examples/vite.config.ts`), dev server ji nemá.
