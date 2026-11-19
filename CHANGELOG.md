# Changelog

Všechny podstatné změny projektu. Formát podle [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/), verze podle [Semantic Versioning](https://semver.org/lang/cs/).

## [0.6.3] – 2026-11-19

### Přidáno
- **Plovoucí lišta editoru:** `addEditor(name, label, { floatingToolbar: true })` (a `<Editor options>`) ukáže lištu jen tehdy, když má editor fokus, plovoucí nad ním a širokou podle tlačítek; pro editory v úzkých místech. Editor phlox-editor je ve verzi 0.3.0.

## [0.6.2] – 2026-11-19

### Opraveno
- **`dragToSort` mezi seznamy už položku neořízne:** s `lists` jede za ukazatelem kopie položky (`phlox-drag-copy`) v top layer, nad seznamy, které se posouvají, i nad modálním dialogem. Položka zůstává neviditelná na svém místě. Čára místa je také v top layer.
- **`dragToSort` mimo všechny seznamy:** označení cílového seznamu a čára zmizí, puštění tam nic nezmění.

## [0.6.1] – 2026-11-18

### Přidáno
- **`dragToSort({ anchor: 'pointer' })`:** pozici určí ukazatel místo středu tažené položky, pro položky hodně různé velikosti (široký sloupec před úzký). Výchozí zůstává `'middle'`.

## [0.6.0] – 2026-11-18

### Přidáno
- **`dragToSort` mezi seznamy:** volba `lists` nabídne další seznamy (`SortList`: prvek, položky, rozložení a `drop(to)`), do kterých jde položku přetáhnout, a `list` označí prvek vlastního seznamu. Nad jiným seznamem se položka v datech nehýbe, seznam dostane třídu `phlox-drop-target` a čára `phlox-drop-marker` ukáže místo; po puštění se zavolá `drop(to)` cílového seznamu. Rozhoduje nejvnitřnější seznam pod ukazatelem, seznam uvnitř tažené položky se nenabízí. Barvu mění `--phlox-drop-color`. Export `DROP_TARGET` a typ `SortList`.

## [0.5.1] – 2026-11-18

### Změněno
- **Texty nahrávání podle počtu souborů:** `addUpload` píše „Přetáhněte soubor sem“, `addMultiUpload` „Přetáhněte soubory sem“, stejně popis zóny pro čtečky. Klíče `upload.heading` a `upload.dropzone` se rozdělily na `headingSingle`/`headingMultiple` a `dropzoneSingle`/`dropzoneMultiple`; kdo je přepisoval v `setTexts()`, musí je přejmenovat.

## [0.5.0] – 2026-11-18

### Přidáno
- **Záložky `<Tabs>` a `<Tab>`:** skryté panely zůstávají ve stránce, takže prvky formuláře v nich drží hodnoty a kontrolují se. Neúspěšná kontrola otevře záložku s první chybou a záložka s chybou má značku. Záložky, které se nevejdou, jsou pod „Další“. Ovládání šipkami podle WAI-ARIA, zvolená záložka jako `state`.
- **`reveal(element)`:** prvek požádá kontejnery kolem sebe, aby ho ukázaly. `focus()` prvků formuláře ji volá samo, takže fokus po kontrole dojde i do skryté záložky.
- **`templateOf()` vrací i děti šablony** (`children`), komponenta tak může číst své vnořené značky jako `<Tabs>` své `<Tab>`.

## [0.4.0] – 2026-11-18

### Přidáno
- **Výchozí řazení gridu:** `new Grid({ sort: { field: 'createdStamp', dir: 'desc' } })`. Platí, dokud uživatel nevybere jiné, třetí klik na sloupec ho vrátí. V URL není.

## [0.3.0] – 2026-11-18

### Přidáno
- **`setReadOnly()` u všech prvků formuláře:** prvek vypadá normálně, ale nejde měnit, hodnota zůstává v `getValues()` a kontroluje se. Pro texty atribut `readonly`, u zaškrtávacích polí, přepínačů, selectů, DropDownList, ComboBox, TagInput, stromů, souborů a editoru WYSIWYG zablokované ovládání.
- **Zakázané položky:** `setDisabled(['M'])` u `addSelect`, `addMultiSelect`, `addRadioList` a `addCheckboxList` jako v Nette, volba `itemDisabled` u DropDownList, ComboBox a TagInput. Položky jsou vidět, vybrat nejdou, šipky je přeskočí.

### Opraveno
- **`addTreeSelect()` / `addTreeMultiSelect()` s `setDisabled()`** šly dál zaškrtávat.

## [0.2.2] – 2026-11-16

### Opraveno
- **Menu akcí v řádku gridu** ukazovalo akce podle dat řádku z jeho prvního vykreslení. Po novém načtení (třeba po aktivaci) zůstalo „Aktivovat“, i když už měla být vidět „Deaktivovat“. Panely gridu (menu akcí, sloupce, filtr s více hodnotami) se teď tvoří při každém otevření. Odhalil to modul štítků v CMS.

## [0.2.1] – 2026-11-14

### Opraveno
- **Notifikace s prázdnou odpovědí:** `RpcClient` bral odpověď 200 s prázdným tělem (tak na notifikaci odpovídají i starší servery JSON-RPC) jako chybu sítě. Prázdné tělo je teď stejné jako stav 204: žádná odpověď.

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

[0.6.3]: https://github.com/phloxcz/phlox-js/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/phloxcz/phlox-js/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/phloxcz/phlox-js/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/phloxcz/phlox-js/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/phloxcz/phlox-js/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/phloxcz/phlox-js/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/phloxcz/phlox-js/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/phloxcz/phlox-js/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/phloxcz/phlox-js/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/phloxcz/phlox-js/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/phloxcz/phlox-js/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/phloxcz/phlox-js/releases/tag/v0.1.0
