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
3. **Kanban s Nette backendem:** vnořený router, DI, RPC přes `phlox-rpc-api`, typy generované z PHP, oprávnění a drag & drop. **Rozpracováno, tady se pokračuje.** Hotové: DI kontejner s autowiringem, `Component`, `Presenter`, vnořený router až do dialogů, `Translator`, `Application`, RPC klient s typy generovanými z OpenRPC (`phlox-js/net`), `User` a `Permission` (`phlox-js/security`), formuláře podle Nette (`phlox-js/forms`) a ukázka `examples/shopping-list`. Použití je v [guide.md](guide.md). Hotové jsou i prvky formulářů dropdownlist, combobox a taginput převzaté z PHP knihoven. Zbývá: přihlášení přes RPC vyzkoušet proti skutečnému serveru, persistentní parametry a samotný kanban.
4. **Adaptér pro Kendo:** obalit Kendo Grid, jeden formulářový prvek a okno, včetně vazby na `state` a úklidu. Bez toho framework pro CMS nestačí.
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
