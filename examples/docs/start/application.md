# Aplikace a bootstrap

```ts
// main.ts
import { Application } from '@phloxcz/phlox-js';
import { services } from './services';
import { AppPresenter } from './presenters/AppPresenter';

const app = new Application(services);
void app.run(AppPresenter, document.getElementById('app')!);
```

`run` vytvoří kořenový presenter, zpracuje aktuální URL a výsledek vloží do prvku.

- **`app.onError`** dostane každou chybu běžící aplikace, viz oddíl Chyby aplikace níž.
- **`app.restart()`** postaví celý strom presenterů znovu na stejné URL. Hodí se po změně jazyka.
- **`app.basePath`** je cesta, pod kterou aplikace na webu běží, když není v kořeni: `app.basePath = '/admin'` před `run()`. Routy se počítají od ní, odkazy ji obsahují (`link('/about')` dá `/admin/about`) a odkaz mimo ni načte prohlížeč jako jinou stránku. Server musí na každou adresu pod ní vrátit stránku aplikace.
- **`app.presenter`** je kořenový presenter, **`app.router`** router, **`app.flashes`** flash zprávy, **`app.user`** přihlášený uživatel.

Projekt potřebuje ve `vite.config.ts` plugin kvůli autowiringu a v `tsconfig.json` nastavení TSX (viz Šablony):

```ts
import { phlox } from '@phloxcz/phlox-js/vite';

export default defineConfig({ plugins: [phlox()] });
```

## Chyby aplikace

`app.onError(error, source)` je jediné místo pro chyby aplikace, jako Tracy v Nette. Druhý parametr říká, odkud chyba je:

| `source` | Odkud |
|---|---|
| `'navigation'` | akce, `startup()` presenterů a dialogů na cestě na stránku; stará obrazovka zůstane |
| `'lifecycle'` | `startup()` komponenty uvnitř pohledu, `afterRender()` |
| `'event'` | obsluha události (i asynchronní), akce gridu a stromu, odeslání formuláře |
| `'resource'` | načítání `resource()` |
| `'global'` | všechno ostatní, co prohlížeč ohlásí na `window`: chyba v časovači, promise, na který nikdo nečeká (`void this.load()`), efekt spuštěný z nich |

Výchozí je `console.error`. Typicky chybu ukážeš a pošleš na server:

```ts
app.onError = (error, source) => {
  console.error(error);
  app.flashes.add(error instanceof Error ? error.message : String(error), 'error');
  void errorLog.send(error, source).catch(() => {}); // chyba logování se už neloguje
};
```

- **Globální chyby** (`error` a `unhandledrejection` na `window`) aplikace poslouchá od `run()` do `stop()`. Prohlížeč je pak sám nevypíše znovu do konzole, vypisuje je `onError`.
- **Hlášku ResizeObserveru** (`ResizeObserver loop…`) aplikace přeskočí: prohlížeč ji hlásí jako chybu, ale není to chyba aplikace a sám se z ní vzpamatuje.
- **Vlastní volání** `app.onError(error)` zdroj vynechat smí, obsluha ho pak dostane jako `undefined`. Framework ho předává vždy.
- **Chyba v `onError`** se jen vypíše do konzole, znovu do `onError` nejde, aby nevznikla smyčka.
- **Chyby načtení obrázků a skriptů** na `window` nebublají, `onError` je nedostane.
