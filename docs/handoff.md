# PhloxJS: výchozí kontext projektu

Shrnutí rozhovoru z 6. 11. 2026, který vedl k založení tohoto repa. Nový chat má z tohoto dokumentu pochopit, co se stavět má, proč a co bude dál.

## Cíl

PhloxJS je frontendový framework, který přenáší způsob práce z Nette do prohlížeče: presentery a komponenty, životní cyklus, persistentní parametry, oprávnění a dependency injection. Používá TSX a reaktivitu ve stylu Knockoutu, bez Reactu.

Je součástí ekosystému `phloxcz`. Zatím slouží autorovi. Stát se preferovaným frontendem pro Nette může později, pokud se to osvědčí, ale návrh se tomu teď nepodřizuje.

**První ostrý projekt:** přes deset let starý CMS, který je dobrý, ale špatně napsaný. Má se přesunout na phlox knihovny a na tento framework. Podrobnosti o něm zatím neznáme.

**Tracedo se neupravuje.** Slouží jen jako zdroj zkušeností.

## Výchozí kód: TraceJS

Framework vychází z knihovny `d:\Web\abra\BDP\NEW.tracedo\client\tracejs\src` (asi 4 400 řádků), nad kterou v Tracedu stojí asi 37 000 řádků aplikace. Kód se nepřebírá kopírováním. Přebírají se nápady a kód se píše znovu, aby se nepřenesly chyby níže.

### Co se osvědčilo a má zůstat

- Strom ViewModelů, kde se URL postupně rozděluje mezi úrovně.
- Rámec `<route-frame>`. `<view-frame>` nahrazuje přímé použití komponenty v TSX (viz [design.md](design.md)).
- `startup()`, flash zprávy a `User`/`Identity`/`Permission` podle Nette. Persistentní parametry se v JS neověřily, návrh vychází z Nette.
- TSX šablony bez virtuálního DOMu.

### Chyby, kterým se vyhnout

Každá z nich má mít v PhloxJS regresní test.

Seznam popisuje stav před commitem `58aa7e5` v Tracedu (6. 11. 2026). Ten opravil všechny body sekce Router a teardown při výměně komponenty. Pokud jde o pády a teardown, dnešní TraceJS už tedy není protipříklad, ale testy v PhloxJS mají smysl dál. Podle kódu trvá dočasný uzel po selhání `run()` a to, že úklid závisí na autorovi view. Router také navigace řadí do fronty a běžící neruší. Sekce JSX a Typy nebyly po tomto commitu znovu ověřené.

**Router**
- Parser query stringu umožňuje prototype pollution přes `?__proto__[x]=1` (ověřeno spuštěním).
- Hodnota obsahující `=` se ořízne (ověřeno spuštěním).
- Routa se dvěma parametry se nikdy nenamatchuje, protože nahrazení v regexu nemá příznak `g` (ověřeno spuštěním).
- Navigace se nečekají ani neruší, takže pomalejší starší navigace může přepsat novější.
- Neznámá URL u ViewModelu s potomkem spadne na `match.final` nad `null`.
- Parametr routy s hodnotou `0` se bere jako chybějící a persistentní query parametr nejde nastavit na `0` ani na prázdný text.

**Životní cyklus**
- Při výměně komponenty se teardown volá na rodiči místo na staré komponentě.
- Teardown potomka není vždy rekurzivní a nečeká se na něj.
- Když `run()` selže, zůstane v DOM dočasný uzel.
- V aplikaci nikdo teardown nepřepisuje. Úklid tedy musí být automatický, ne na vůli autora view.

**JSX**
- `disabled={false}` vyrobí `disabled="false"`, takže prvek zůstane zakázaný.
- Fragment zahodí své potomky.
- Nejsou podporované funkční komponenty.
- `IntrinsicElements` je `any`, takže se atributy nekontrolují.

**Typy a úklid**
- 2 104 textových `data-bind` bez kontroly kompilátorem. PhloxJS je mít nebude.
- Ze 187 volání `rpc.call` jsou jen 2 s typem.
- Žádné testy, vypnuté `strictNullChecks`, zakomentovaný kód v repu.
- Závislost na globálním `jQuery` a `ko`.

## Rozhodnutí

| Rozhodnutí | Důvod |
|---|---|
| Vlastní malé reaktivní jádro a renderer, bez kompilátoru | Malý rozsah (odhad 1–2 tisíce řádků), který si autor přečte celý. Stačí TypeScript a vlastní `h()`. API lze navrhnout podle Nette. |
| Solid je záložní plán | Je licencovaný MIT a má podobný model. Přechod nastane, pokud vlastní renderer neobstojí v rozhodovacím bodě (viz plán). |
| Bez Reactu | Autor ho nemá rád a ani jeden z důvodů pro něj (nábor, předávání týmu) tu teď neplatí. |
| Bez Knockoutu | Vývoj je prakticky neaktivní a textové bindingy nejsou typově kontrolované. |
| Bez jQuery v jádru | Samostatný framework nemá stát na globální závislosti. Kendo ho potřebuje, ale to řeší oddělený adaptér. |
| Složité widgety v SPA zajišťuje Kendo UI | Autor ho používá a minimálně v CMS zůstane. `phlox-grid` je jen pro Nette s Naja. |
| Reaktivní hodnoty se jmenují `state`, ne `signal` | „Signál“ v Nette znamená `handleXxx`. Názvy by se pletly. |
| DI přes konstruktor s autowiringem | Malý plugin pro Vite doplní seznam závislostí při buildu, podobně jako Nette kompiluje kontejner. Podrobnosti a ověření jsou v [design.md](design.md). |

### Přibližná podoba API

Je to náčrt, ne hotový návrh:

```tsx
class ShoppingListPresenter extends Presenter {
  items = state<Item[]>([]);

  constructor(private api: ShoppingApi) { super(); }

  async startup() {
    this.items.set(await this.api.list());
  }

  render = () => (
    <ul>
      <For each={this.items}>
        {item => <li class={() => item.done() ? 'done' : ''}>{item.name}</li>}
      </For>
    </ul>
  );
}
```

Reaktivní je to, co se předá jako `state` nebo funkce. Atributy a přístup k členům třídy kontroluje kompilátor.

## Vazba na phlox knihovny

Knihovny leží vedle tohoto repa v `d:\Projekty\phlox\` a jsou na GitHubu pod `phloxcz`.

- **`phlox-rpc-api`, `phlox-api-core`:** JSON-RPC server. Tabulka metod se kompiluje do DI kontejneru z PHP atributů a nativních typů. To je přirozený zdroj pro generování TypeScript typů a hlavní přínos propojení s Nette.
- **`phlox-rest-api`, `phlox-api-query`, `phlox-entity-database`:** další části backendu, které se mají použít v ukázkách. `phlox-api-sample` ukazuje, jak do sebe zapadají, a má entity `Project`, `Task` a `User`, což se hodí pro kanban.
- **`phlox-grid`:** je čistě pro Nette a používá Naja. Pro SPA se používat nebude (rozhodnutí autora).
- **`phlox-tree`, `phlox-upload`, `phlox-combobox`, `phlox-dropdownlist`, `phlox-taginput`, `phlox-editor`:** serverové Nette komponenty s vlastními JS assety. Použitelnost pod SPA je potřeba ověřit u každé zvlášť, automaticky s ní nepočítat.
- **`capify`:** dialogy bez závislostí, balíček `@phloxcz/capify`. Může rovnou nahradit `alert`/`confirm`/`prompt`.

## Kendo UI

Pro SPA se používá Kendo UI a použije se minimálně i v CMS (rozhodnutí autora). Grid ani další složité widgety se tedy v první fázi nepíšou vlastní.

Z toho plyne:
- **Oddělený adaptér:** napojení na Kendo patří do samostatného balíčku, ne do jádra. Kendo je komerční a stojí na jQuery, zatímco jádro má zůstat bez obou závislostí. Bude to vstup `phlox-js/adapters/kendo` (rozhodnuto 11. 11. 2026), postavený stejně jako `phlox-js/adapters/capify`: služby a prvky, které nahradí výchozí (`Dialogs` → Kendo Window, prvky formulářů → Kendo widgety, grid jako komponenta). Viz Adaptéry v [design.md](design.md).
- **jQuery zůstává v aplikaci:** kvůli Kendo ho aplikace načítá, jádro ho ale nepoužívá.
- **Životní cyklus widgetu:** adaptér musí svázat `state` s hodnotami widgetu v obou směrech a při úklidu widget sám zničit.
- **Typy a prvky bez závislosti na adaptéru:** běžné view musí jít psát i bez Kendo.

### Konvence ekosystému

- Adresář `phlox-<název>`, npm scope `@phloxcz`, licence MIT.
- `README.md` anglicky a `README.cs.md` česky.
- Přísné nástroje a testy, u PHP knihoven `phpstan` a `tests`.

## Plán

1. **Návrh:** krátký dokument, jak se pojmy z Nette převádějí do PhloxJS (presenter, životní cyklus, komponenty, signály `handleXxx`, persistentní parametry, oprávnění, DI). Autor ho připomínkuje dřív, než vznikne kód. **Hotovo:** [design.md](design.md), schváleno autorem.
2. **Nákupní seznam:** `state`, `computed`, renderer, `<If>`, `<For>`, automatický úklid a testy (včetně diamantových závislostí a překreslování seznamů). **Hotovo, čeká na review autora:** popis je v [design.md](design.md).
3. **Kanban s Nette backendem:** vnořený router, DI, RPC přes `phlox-rpc-api`, typy generované z PHP, oprávnění a drag & drop. **Rozpracováno, tady se pokračuje.** Hotové: DI kontejner s autowiringem, `Component`, `Presenter`, vnořený router až do dialogů, `Translator`, `Application`, RPC klient s typy generovanými z OpenRPC (`phlox-js/net`), `User` a `Permission` (`phlox-js/security`), formuláře podle Nette (`phlox-js/forms`) a ukázka `examples/shopping-list`. Použití je v [guide.md](guide.md). Hotové jsou i prvky formulářů dropdownlist, combobox a taginput převzaté z PHP knihoven. Formuláře mají vnořené kontejnery a řádky (`addContainer`, `addMultiplier`) s řazením tažením (`dragToSort`), které poslouží i kanbanu, a výběr souborů (`addUpload`, `addMultiUpload`). Hotový je strom podle `phlox-tree` (`phlox-js/components`) s líným načítáním, animací, výběrem podle URL, přetahováním myší i prstem a výběrem ve formuláři (`addTreeSelect`, `addTreeMultiSelect`, `addDropDownTreeSelect`), ukázka je v `examples/tree`. Hotový je grid podle `phlox-grid` s dotazem ve formátu `phlox-api-query`, stavem v URL přes persistentní parametry presenterů a nastavením sloupců v prohlížeči, ukázka je v `examples/grid`. Ukázky běží jako jeden web s rozcestníkem (`npm run dev`), aplikace umí běžet v podadresáři (`app.basePath`). Zprávy z capify jsou převzaté do frameworku: toasty pro flash zprávy (výchozí), `alert`, `confirm`, `prompt` a `loading` v okně frameworku a popover u prvku. Hotová je ukázka `examples/helpdesk` podle návrhu autora: celá aplikace proti mock JSON-RPC serveru ve Vite (přihlášení s tokenem, vnořené presentery, `resource()`, `<Dropdown>`, nahrávání souborů po částech). Co při ní framework získal a co zbývá, je v [design.md](design.md) v oddílu Helpdesk. Zbývá: přihlášení přes RPC vyzkoušet proti skutečnému serveru a samotný kanban.

**TODO helpdesku (zadal autor 12. 11. 2026):**
- **Zadávání úkolů** (zadal autor 14. 11.): tlačítko pro přidání, vyjíždějící formulář (panel z boku) pro nový úkol i úpravu, smazání s dotazem.
- **Detail úkolu přes `resource()` se štítkem `tasks`** (nahlásil autor 14. 11.): zaškrtnutí otevřeného úkolu v seznamu jako splněného se v detailu neprojeví, protože si detail úkol načítá sám mimo `app.invalidate('tasks')`.
- **Worklogy:** u úkolu vykázat, kolik hodin kdo kdy na něm strávil (záznamy s datem, časem a poznámkou, součty).
- **Kanban pohled** podle návrhu `d:\Projekty\phlox\Kanban HelpDesk Pro v češtině.png`: úkoly ve sloupcích podle stavu, přetahování mezi nimi. **Samostatná položka v hlavním menu** (doplnil autor 13. 11.).
- **Požadavky (v kódu a API `ticket`: `ticket.list`, `ticket.convert`, `TicketResource`), samostatná položka v hlavním menu** (zadal autor 13. 11., název rozhodl autor; ne „request“, pletl by se s HTTP požadavkem): požadavky, které do helpdesku přijdou zvenku.
  - **Údaje:** priorita, typ (požadavek na novou funkcionalitu, chyba, dotaz…), stav (Nové, Zpracované, Zamítnuté), zdroj (web, widget, e-mail), odesílatel, předmět, text, přílohy. V menu počet nezpracovaných. **Požadavek není úkol:** operátor ho projde, zvolí projekt a řešitele a vytvoří z něj úkoly, z jednoho požadavku jich může vzniknout víc (třeba dva úkoly pro dva lidi). Požadavek si má pamatovat, jaké úkoly z něj vznikly.
  - **Odkud přicházejí:**
    - přes API z formuláře na webu,
    - přes API z widgetu pro hlášení chyb vložitelného do jiné aplikace,
    - e-mailem: backend poslouchá na schránce přes IMAP, co tam kdo pošle, stáhne a založí jako požadavek (předmět, text, odesílatel, přílohy).
  - Pro backend (mock teď, `phlox-rpc-api` později): metody pro založení požadavku zvenku (bez přihlášení operátora, s ochranou proti spamu) a pro převod požadavku na úkoly.
- **Mock RPC v prohlížeči pro statické sestavení** (cesta 1; zatím není potřeba, autor spouští sestavení přes `vite preview`, kde mock běží; udělat, až budou ukázky potřeba vystavit na statický hosting): `npm run build:examples` dá `dist`, které jde pustit z libovolného statického serveru (`php -S`, GitHub Pages). Helpdesk ve statickém sestavení použije `createRpcMock(...).fetch` místo sítě; v mocku nahradit Node `Buffer` prohlížečovou variantou a data ukládat do `localStorage`, aby přežila obnovení stránky. Dev server a `vite preview` dál s mockem ve Vite.

**TODO frameworku (z helpdesku, sepsáno 12. 11. 2026, v navrženém pořadí):**
1. ~~Chyby asynchronních obsluh událostí~~ **hotovo 13. 11.:** chyby obsluh jdou do `app.onError`.
2. ~~Sdílená data mezi obrazovkami~~ **hotovo 13. 11.:** štítky zdrojů, `app.invalidate()`, `app.resource()`; čeká na review, viz design.md.
3. ~~Titulek stránky a fokus po navigaci~~ **hotovo 13. 11.:** `Presenter.pageTitle()`, `app.formatTitle`, ohlášení navigace čtečkám, fokus na `<h1>`, když zmizel.
4. **Kanban** jako ověření bodů 2 a 3 (viz TODO helpdesku). Adaptér pro Kendo je hotový (bod 4 plánu níže), zbývá ho vyhodnotit na reálné obrazovce CMS.
5. ~~Testování aplikací~~ **hotovo 13. 11.:** `phlox-js/testing` (`bootApp`, `cleanup`, `until`, `type`, `press`), `createRpcMock` v `phlox-js/net`, test celé aplikace `tests/helpdesk.test.tsx`.
6. ~~Typované parametry rout~~ **hotovo 13. 11.:** `<id:int>`, `route()`, `link(route, params)` kontrolovaný kompilátorem, chyba u ztraceného lomítka.
7. **Velké seznamy:** zátěžový test s 10 000 řádky (bod 5 plánu), případně virtuální posouvání.
7b. ~~Offline pro techniky v terénu~~ **hotovo 13. 11., čeká na review:** `RpcOffline` v `phlox-js/net` (uložená data, fronta, příprava, dotaz u změněného záznamu), helpdesk jako PWA s přípravou projektu pro offline. Další kroky (značky metod v `phlox-rpc-api`, přílohy offline, kontrola opakovaného zápisu) jsou v design.md v oddílu „Práce offline“.
7a. **PWA, jen část (domluveno s autorem 13. 11.):** instalovatelnost a cache helpdesku hotové (viz 7b), `online()` hotové; zbývá obecné upozornění na novou verzi ve frameworku (v helpdesku je zatím v `main.ts` přes `vite-plugin-pwa`).
   - **Upozornění na novou verzi ve frameworku:** po nasazení zůstane v otevřené záložce stará SPA a volá nové API. Služba, která novou verzi pozná (service worker nebo kontrola verze) a nabídne „Je dostupná nová verze, načíst?“.
   - **Stav připojení jako `state`:** `online()`, aby aplikace ukázala „jste offline“ a chyby sítě nešly do toastů.
   - **Instalovatelnost a cache aplikace** v helpdesku přes `vite-plugin-pwa` (Workbox), v konfiguraci aplikace, ne v jádru.
   - **Push notifikace** až s Web Push na straně Nette. Práce offline s daty nakonec vznikla, viz 7b.
7c. **Web s ukázkami jako dokumentace** (nápad autora 13. 11.): jedna aplikace na frameworku, vlevo menu podle částí frameworku (Reaktivita, Šablony, Komponenty, Presentery a routy, Dialogy, Formuláře a prvky, Grid, Strom, RPC, Offline, Kendo…), u každé části ukázky od jednoduché po složitou, jako dema Kendo UI: popis, živá ukázka a záložka s kódem.
   - **Kód na webu je kód, který běží:** soubor ukázky se načte i jako text (`?raw` ve Vite), zobrazený kód se nerozejde se skutečným.
   - **Každá ukázka je zároveň test:** Vitest je všechny vykreslí, nefunkční ukázka se pozná při `npm test`.
   - **Dosavadní ukázky** se rozpustí do sekcí (strom kategorií ke Stromu, objednávky ke Gridu, Kendo ke Kendu), helpdesk zůstane jako celá aplikace.
   - **Text (rozhodl autor 13. 11.):** příručka se rozdělí do markdownu po stránkách vedle ukázek, např. `examples/docs/forms/dropdownlist.md` vedle `dropdownlist-basic.tsx` a `dropdownlist-remote.tsx`. Živou ukázku vloží značka `<!-- demo: dropdownlist-remote -->`, aplikace na jejím místě vykreslí ukázku a záložku s jejím kódem (`?raw`). Markdown převede na HTML Vite při sestavení, aplikace knihovnu na markdown nepotřebuje.
   - **Menu** podle složek (`reactive/`, `templates/`, `components/`, `presenters/`, `forms/`, `grid/`, `tree/`, `net/`, `offline/`, `kendo/`), pořadí a názvy v jednom souboru s obsahem.
   - **`guide.md` zůstane jen rozcestník** (co kde je, jak spustit, odkaz na web ukázek); žádný text na dvou místech. **CLAUDE.md se upraví:** příručka jsou `examples/docs/**/*.md`, s každou změnou API se upraví stránka i její ukázka; důvody návrhu dál v `design.md`.
   - **Test:** Vitest projde všechny značky `demo`, ověří, že ukázka existuje a vykreslí se.
   - **Postup:** kostra webu a sekce, které už ukázky mají (Strom, Grid, Formuláře, Kendo), pak ostatní; rozdělení stávající příručky je hlavně přesun textu.
8. **Drobnosti:**
   - jeden balíček českých textů frameworku místo nastavování v každé aplikaci (`messageTexts`, `DropDownList.texts`, `Grid.texts`, `Form.messages`…),
   - události předané do `<Input>` (`onBlur`, `onInput`) přepíše vlastní obsluha prvku, `ref` už je vyřešený,
   - ukládání rozložení gridu převést na `Preferences`,
   - `form.autosave` místo ručního `effect` (rychlé akce helpdesku),
   - pomocník pro odložené hledání (debounce) u `resource`,
   - helpdesk vyzkoušet proti skutečnému `phlox-rpc-api` s přihlášením a typy vygenerovanými z OpenRPC.
4. **Adaptér pro Kendo:** obalit Kendo Grid, jeden formulářový prvek a okno, včetně vazby na `state` a úklidu. Bez toho framework pro CMS nestačí. **Hotovo 13. 11., čeká na review:** `phlox-js/adapters/kendo` (`KendoWidget`, `KendoGrid`, `KendoDialogs`, `KendoControl`), ukázka `examples/kendo` se skutečným Kendo UI 2026.4; co zbývá ověřit, je v design.md.
5. **Rozhodnutí před převodem CMS:**
   - Zátěžový test s velkým seznamem, třeba 10 000 řádků.
   - Vyhodnotit, jestli se Kendo adaptér osvědčil na reálné obrazovce.
   - Když renderer neobstojí nebo se chyby v překreslování budou stále vracet, přejít na Solid.

## Jak spolu pracujeme

- Autor rozhoduje o návrhu a dělá review. Claude píše a udržuje kód.
- Claude si mezi sezeními pamatuje málo, takže rozhodnutí, architektura a jejich zdůvodnění musí být v repu.
- Kód musí zůstat tak malý a čitelný, aby ho autor uměl opravit i bez Claude.

## Otevřené otázky

- Co přesně má CMS za obrazovky, kolik gridů a formulářů a kde je jeho kód?
- Jaká verze Kendo UI se má použít? V Tracedu je 2021.3, tedy starší.
- Jaký bude název npm balíčku (nebo balíčků) a název repa na GitHubu? Adresář je zatím `phlox-js`.
- Jeden balíček, nebo oddělené `core`, `router`, `security`, `rpc` a `nette-bridge`? Rozhodne se až po kanbanu.
- Build a testy: od kroku 2 se používá Vite a Vitest, testy běží v jsdom. DI plugin stojí na Vite, jinou volbu by to zdražilo.
- Jak řešit syntaxi šablon u Latte a serverového vykreslování, pokud bude CMS kombinovat obojí?
