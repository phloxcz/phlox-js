# Aplikace a bootstrap

```ts
// main.ts
import { Application } from 'phlox-js';
import { services } from './services';
import { AppPresenter } from './presenters/AppPresenter';

const app = new Application(services);
void app.run(AppPresenter, document.getElementById('app')!);
```

`run` vytvoří kořenový presenter, zpracuje aktuální URL a výsledek vloží do prvku.

- **`app.onError`** dostane chyby z navigace a z metod životního cyklu. Výchozí je `console.error`, typicky je chceš i ukázat: `app.onError = error => app.flashes.add(String(error), 'error')`.
- **`app.restart()`** postaví celý strom presenterů znovu na stejné URL. Hodí se po změně jazyka.
- **`app.basePath`** je cesta, pod kterou aplikace na webu běží, když není v kořeni: `app.basePath = '/admin'` před `run()`. Routy se počítají od ní, odkazy ji obsahují (`link('/about')` dá `/admin/about`) a odkaz mimo ni načte prohlížeč jako jinou stránku. Server musí na každou adresu pod ní vrátit stránku aplikace.
- **`app.presenter`** je kořenový presenter, **`app.router`** router, **`app.flashes`** flash zprávy, **`app.user`** přihlášený uživatel.

Projekt potřebuje ve `vite.config.ts` plugin kvůli autowiringu a v `tsconfig.json` nastavení TSX (viz Šablony):

```ts
import { phlox } from 'phlox-js/vite';

export default defineConfig({ plugins: [phlox()] });
```
