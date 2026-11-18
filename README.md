# PhloxJS

Frontendový framework, který přenáší způsob práce z Nette do prohlížeče: presentery a routy, komponenty, formuláře podle `Nette\Forms`, DI s autowiringem, uživatel a oprávnění. Šablony v TSX, překreslování jemnou reaktivitou (`state`), bez virtuálního DOM.

Ve frameworku jsou i grid, strom, dialogy, WYSIWYG editor, JSON-RPC klient pro [phlox-rpc-api](https://github.com/phloxcz/rpc-api), práce offline a pomocníci pro testy. Vzhled je výchozí, nebo Bootstrap 5.

## Instalace

```bash
npm install github:phloxcz/phlox-js#v0.4.0
```

Balíček zatím není na npm, instaluje se z GitHubu podle tagu. Potřebuje Vite (od verze 7) a TypeScript s `"moduleResolution": "Bundler"`. Typy z OpenRPC dokumentu `phlox-rpc-api` vygeneruje `npx phlox-rpc-types <url> src/api/rpc.ts`.

## Příklad

```tsx
import { Application, Container, Presenter, state } from '@phloxcz/phlox-js';

class HomePresenter extends Presenter {
  public readonly count = state(0);

  public render() {
    return <button onClick={() => this.count.update(n => n + 1)}>Kliknuto: {this.count}</button>;
  }
}

void new Application(new Container()).run(HomePresenter, document.getElementById('app')!);
```

`vite.config.ts` potřebuje plugin kvůli autowiringu a `tsconfig.json` TSX s `"jsxImportSource": "@phloxcz/phlox-js"`:

```ts
import { phlox } from '@phloxcz/phlox-js/vite';

export default defineConfig({ plugins: [phlox()] });
```

## Dokumentace

Příručka je web s živými ukázkami, sám postavený na PhloxJS:

```bash
npm install
npm run dev        # příručka na http://localhost:5173/, ukázková aplikace na /helpdesk
```

Text je v `examples/docs`, důvody návrhu v [docs/design.md](docs/design.md).

## Vývoj

```bash
npm test                  # testy (Vitest, jsdom)
npm run typecheck         # kontrola typů
npm run build:examples    # sestavení příručky a ukázkové aplikace
```

## Licence

[MIT](LICENSE)
