# PhloxJS: příručka

Příručka je web s živými ukázkami, sám postavený na PhloxJS. Spustí se příkazem `npm run dev` a běží na `http://localhost:5173/`. Ukázka každé funkce je na stránce vedle textu, záložka Kód ukazuje soubor, který běží.

## Kde co je

| Co | Kde |
|---|---|
| Text příručky | `examples/docs/<sekce>/<stránka>.md`, menu a pořadí v `examples/docs/contents.ts` |
| Ukázky | `examples/docs/<sekce>/<ukázka>.tsx` vedle stránky, na stránce značkou `<!-- demo: ukázka -->` |
| Pomocné soubory ukázek | `examples/docs/<sekce>/_<jméno>.ts(x)`, ukázkami nejsou (data, líně načítaný presenter) |
| Aplikace webu | `examples/docs/` (`main.ts`, `DocsPresenter.tsx`, `PagePresenter.tsx`, `page.tsx`, plugin `markdown.ts`), ukázky s routami v rámu `examples/frame/` |
| Celá aplikace | `examples/helpdesk`, na webu odkaz v hlavičce (`/helpdesk`) |
| Důvody návrhu | [design.md](design.md) |
| Cíl, plán, TODO | [handoff.md](handoff.md) |

## Příkazy

| Příkaz | Co dělá |
|---|---|
| `npm run dev` | web s příručkou na `/` a helpdesk na `/helpdesk` (s mock JSON-RPC serverem) |
| `npm run build:examples` | sestaví obojí do `examples/dist`; `npx vite preview --config examples/vite.config.ts` ho spustí i s mock serverem |
| `npm test` | testy, mezi nimi `tests/docs.test.tsx`: každá stránka je v menu, každá ukázka existuje a vykreslí se bez chyby |
| `npm run typecheck` | kontrola typů, i ukázek |

## Jak psát stránku

- **Text** je markdown. Nadpis `#` je titulek stránky, `##` oddíly. Odkaz na jinou stránku se píše jako na soubor: `[Prvky](../forms/controls.md)`, plugin z něj udělá adresu webu.
- **Ukázka** je soubor `.tsx` s výchozím exportem: komponenta se vykreslí přímo ve stránce, presenter (routy, odkazy, dialogy s URL) běží v rámu s vlastním adresním řádkem a titulkem.
- **Služby ukázky** exportuje funkce `services(container)`, web je zaregistruje, než ukázku ukáže.
- **S každou změnou veřejného API** se upraví stránka i její ukázka. Kompilátor a test webu pak hlídají, že text a kód nejdou od sebe.
