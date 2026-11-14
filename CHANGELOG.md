# Changelog

Všechny podstatné změny projektu. Formát podle [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/), verze podle [Semantic Versioning](https://semver.org/lang/cs/).

## [0.2.0] – 2026-11-14

### Změněno
- **Balíček se jmenuje `@phloxcz/phlox-js`,** jako ostatní knihovny ekosystému. Importy jsou `from '@phloxcz/phlox-js'`, `'@phloxcz/phlox-js/forms'`…, v `tsconfig.json` aplikace `"jsxImportSource": "@phloxcz/phlox-js"`. Typy vygenerované příkazem `phlox-rpc-types` importují `@phloxcz/phlox-js/net`. Repozitář i instalace z GitHubu (`github:phloxcz/phlox-js#v0.2.0`) zůstávají.

## [0.1.0] – 2026-11-14

První vydání.

- **Jádro:** `state`, `computed`, `effect`, `batch`, šablony v TSX bez virtuálního DOM, `<If>`, `<For>`, automatický úklid.
- **Aplikace:** komponenty a presentery se životním cyklem z Nette, vnořené routy až do dialogů, typované routy, persistentní parametry, líné načítání presenterů, titulek stránky, otázka před odchodem s neuloženými změnami, DI kontejner s autowiringem (plugin `@phloxcz/phlox-js/vite`).
- **Dialogy a zprávy:** dialogy a boční panely s URL i bez ní, `alert`, `confirm`, `prompt`, `showLoading`, flash zprávy jako toasty, `Dropdown` a `DropdownItem`.
- **Formuláře** (`@phloxcz/phlox-js/forms`) podle `Nette\Forms`: prvky, pravidla a podmínky, chyby ze serveru, kontejnery a řádky, DropDownList, ComboBox, TagInput, soubory, výběr ze stromu, WYSIWYG editor (phlox-editor, načítaný líně).
- **Komponenty** (`@phloxcz/phlox-js/components`): grid se stavem v URL a strom s líným načítáním a přetahováním.
- **Server** (`@phloxcz/phlox-js/net`): JSON-RPC klient pro `phlox-rpc-api` s typy z OpenRPC (`phlox-rpc-types`), dávky, soubory po částech, mock server, práce offline s frontou změn.
- **Další:** uživatel a oprávnění (`@phloxcz/phlox-js/security`), překlady (`@phloxcz/phlox-js/localization`), texty frameworku česky (`setTexts`, `@phloxcz/phlox-js/locales/cs`), HTML od uživatelů (`<Html>`, `sanitizeHtml`), témata (výchozí, Bootstrap), adaptéry pro Kendo UI a capify, pomocníci pro testy (`@phloxcz/phlox-js/testing`).

[0.2.0]: https://github.com/phloxcz/phlox-js/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/phloxcz/phlox-js/releases/tag/v0.1.0
