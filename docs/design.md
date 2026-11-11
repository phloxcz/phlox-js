# PhloxJS: návrh

Jak se pojmy z Nette převádějí do PhloxJS. Dokument vzniká postupně. Každá část říká, jestli je rozhodnutá, nebo čeká na autora.

## Struktura kódu (rozhodnuto)

Adresáře `src/` odpovídají jmenným prostorům Nette:

| Adresář | Obsah | V Nette |
|---|---|---|
| `reactive/` | `state`, `computed`, `effect`, `Scope` | |
| `ui/` | `Component`, `Presenter`, `RouteFrame`, šablony, `<If>`, `<For>`, dialogy | `Nette\Application\UI` |
| `application/` | `Application`, `Router`, flash zprávy | `Nette\Application`, `Nette\Routing` |
| `di/` | `Container`, Vite plugin pro autowiring | `Nette\DI` |
| `localization/` | `Translator`, `IntlTranslator` | `Nette\Localization` |
| `forms/` | `Form`, prvky, pravidla, vykreslení | `Nette\Forms` |
| `adapters/` | napojení cizích knihoven: `adapters/capify` (flash zprávy přes `@phloxcz/capify`), později `adapters/kendo` | |
| `net/` | RPC klient a generátor typů | |
| `security/` | `User`, `Identity`, `Permission` | `Nette\Security` |

- **Šablony jsou v `ui/`,** ne zvlášť jako obdoba Latte. Jsou s komponentami těsně propojené (rozhodl autor).
- **Flash zprávy:** `flashMessage()` je metoda presenteru jako v Nette, služba, která zprávy drží, patří k aplikaci.

**Importy:** `phlox-js` dává to, co potřebuje každá obrazovka (reaktivita, šablony, komponenty, presentery, aplikace, DI). Volitelné části mají vlastní vstup: `phlox-js/net`, `phlox-js/security`, `phlox-js/forms`, `phlox-js/localization`, `phlox-js/vite` a adaptéry (`phlox-js/adapters/capify`, později `phlox-js/adapters/kendo`).

## Adaptéry (rozhodnuto)

Napojení cizích knihoven nejde do jádra, ale do adaptérů. Adaptér nahradí službu frameworku v kontejneru (`FlashMessages`, `Dialogs`, `Translator`, `UserStorage`...) nebo přidá prvek formuláře (`FormControl`). Presentery a komponenty o knihovně nevědí.

- **Adaptéry jsou v `src/adapters/`, každý s vlastním vstupem** (`phlox-js/adapters/capify`, `phlox-js/adapters/kendo`). Kořen `src/` kopíruje jmenné prostory Nette a napojení cizí knihovny mezi ně nepatří (rozhodl autor). Vlastní vstup je proto, aby aplikace bez té knihovny nic navíc nepotřebovala.
- **Knihovna se adaptéru předá, adaptér ji neimportuje,** pokud to jde: `new CapifyFlashMessages(Capify, options)`. Adaptér pak nemá závislost, potřebuje jen malé rozhraní (`CapifyNotify`) a testuje se s falešnou náhradou. U Kenda to kvůli jQuery a pluginům nejspíš nepůjde, tam bude Kendo volitelná závislost (`peerDependencies`).
- **Vlastní adaptér pro jinou knihovnu** si aplikace napíše stejně, seznam služeb je v příručce.

**Flash zprávy:** výchozí `FlashMessages` drží zprávy pro layout a sama je po 5 s maže. Chyby zůstávají (`errorDuration = 0`), aby je uživatel nepřehlédl. `CapifyFlashMessages` je ukazuje jako toasty capify a časovač nechává na capify (stejné volby `duration`). Ukázka používá capify. Každý vstup je jeden soubor (`src/index.ts`, `src/net/index.ts`...), ostatní soubory jsou vnitřní. Na kořeni `src/` zůstávají jen vstupy: `index.ts`, `vite.ts` a `jsx-runtime.ts`, který si podle názvu hledá kompilátor.

## Presenter a Component (rozhodnuto)

| Třída | Kde se zobrazuje | Co umí navíc | V Nette |
|---|---|---|---|
| `Presenter` | `<RouteFrame />` | routy, persistentní parametry | `Presenter` |
| `Component` | přímo v TSX (`<UserList />`) | | `Control` / komponenta |

`Presenter` dědí od `Component`, takže životní cyklus a úklid jsou na jednom místě.

**Proč ne `ViewModel`:** MVVM popisuje jen to, jak se data dostanou do view (vazba na `state`). Hlavní práce třídy je jiná: routy, persistentní parametry, životní cyklus a správa potomků. To je role presenteru z Nette a cílem je co největší podobnost s Nette. V dokumentaci lze vzor vazeb dál nazývat MVVM.

**Ověřeno na Tracedu:** routy definují jen `App`, `Main`, `Settings` a `Finances` a router prochází jen přes `child`, ne přes komponenty ve `<view-frame>`. Dělení tedy nic nenaruší. Listové obrazovky jako `Users` routy nemají, takže `Presenter` bez rout musí být platný.

## Routování ve stromu (rozhodnuto)

URL se postupně rozděluje mezi úrovně stromu, jako v TraceJS. Osvědčilo se to a zůstává.

Je to vědomý rozdíl proti Nette, kde požadavek obslouží jeden presenter.

Převod metod `routeXxx` z TraceJS na `actionXxx` a `handleXxx` je v sekci Životní cyklus, skutečné chování routeru v sekci Aplikace, presentery, router a dialogy.

## Dialogy (rozhodnuto, API se upřesní při implementaci)

### Co je špatně v Tracedu

Příklad je v `client/src/views/Settings/Users/Users.tsx`, základ v `client/src/views/common/BaseDialogViewModel.tsx`.

- Otevírající view píše tlačítka dialogu, volá `vm.save()` a sám zavírá okno. Dialog tedy není samostatný.
- Dialog potřebuje v rodiči pojmenovaný `<view-frame>`, i když se zobrazuje v okně.
- Výsledek se nevrací. Reakce na uložení je zapsaná přímo v obsluze tlačítka.
- Zavření okna nespustí teardown. Základní třída zničí jen Kendo okno a komponenta zůstane v rodiči, dokud ji nenahradí další.
- Dialog nemá URL, takže na něj nejde odkázat a tlačítko Zpět ho nezavře.

### Co má zůstat

Stejná komponenta jde zobrazit v okně i přímo na stránce. V Tracedu to řeší `settings.dialog`. V PhloxJS proto nemá vzniknout zvláštní třída `Dialog`: v okně lze otevřít běžnou `Component` nebo `Presenter`.

### Návrh

Komponenta sama určuje titulek a tlačítka a zavírá se přes `this.close(výsledek)`:

```tsx
class UserEdit extends Component<{ userId: number | null }, boolean> {
  constructor(private api: UserApi) { super(); }

  override title() {
    return this.props.userId ? 'Upravit uživatele' : 'Nový uživatel';
  }

  override actions() {
    return (
      <>
        <button onClick={() => this.close(false)}>Zavřít</button>
        <button onClick={() => this.handleSave()}>Uložit</button>
      </>
    );
  }

  async handleSave() {
    await this.api.save(/* ... */);
    this.close(true);
  }

  render() {
    return <form>{/* ... */}</form>;
  }
}
```

**Dialog bez URL** (potvrzení, výběr, krátký formulář) vrací výsledek jako promise:

```ts
const saved = await this.openDialog(UserEdit, { userId });
if (saved) this.grid.reload();
```

**Dialog s URL** se deklaruje u routy:

```ts
override routes: Route[] = [
  { name: 'default', pattern: '/' },
  {
    name: 'edit',
    pattern: '/<id \\d+>',
    dialog: ({ id }) => [UserEdit, { userId: Number(id) }],
    closed: saved => { if (saved) this.grid.reload(); },
  },
];
```

Routovaný dialog je obyčejný potomek ve stromu, jen se místo do `<RouteFrame />` zobrazí do okna. Router tak nepotřebuje zvláštní větev a dialog může mít vlastní routy, pokud je to `Presenter`.

### Pravidla

- **Úroveň:** dialog patří presenteru, jehož obrazovka má zůstat pod ním. Na `/users/15` zůstává vidět `Users`.
- **Úklid:** dialog je potomek ve stromu. Teardown proběhne při zavření i při odchodu rodiče.
- **Zavření routovaného dialogu:** když se na něj přišlo uvnitř aplikace, volá se `history.back()`. Jinak by Zpět dialog znovu otevřelo. Po přímém odkazu se volá `replaceState` na výchozí routu presenteru, aby Zpět neopustilo aplikaci.
- **Výsledek routovaného dialogu:** promise by po obnovení stránky neměla kdo čekat, proto `closed` u routy. Zavře-li dialog navigace, přijde `undefined`.
- **Nečekat na dialog v `actionXxx`:** navigace běží po jedné, takže čekání na uživatele by blokovalo všechny další.
- **Okno je výměnné:** jádro používá nativní `<dialog>` bez závislostí, Kendo adaptér ho může nahradit `kendoWindow`. `alert`, `confirm` a `prompt` řeší `capify`.

### Odloženo

- Zadržení odchodu s neuloženými změnami: tlačítko Zpět mění URL dřív, než se framework může zeptat, takže URL by se musela vracet. První verze to neřeší, doplní se až podle potřeby u kanbanu nebo CMS.
- Dialog nad libovolnou obrazovkou (třeba profil uživatele) nemá přirozenou úroveň ve stromu. Možná ho vyřeší query parametr, ale první verze s ním nepočítá.

## Závislosti (rozhodnuto)

**Pravidlo:** jádro nemá žádné závislosti za běhu. Vývojové nástroje (TypeScript, Vite, Vitest) jsou v pořádku, protože jejich výměna se aplikace nedotkne. Co je velké a cizí (Kendo), patří do odděleného adaptéru.

**Vlastní kód musí být malý a pokrytý testy.** Riziko se tím nezruší, jen se přesune: místo cizí knihovny, která může skončit, je tu vlastní kód, který může obsahovat chyby. TraceJS bez testů nasbíral chyby, které se opravovaly až po letech (commit `58aa7e5`).

| Co TraceJS používá | Stav na npm (11/2026) | PhloxJS |
|---|---|---|
| Knockout | 3.5.1 z roku 2019, pak jen 3.5.2 a 3.5.3 v březnu 2026 | vlastní `state` a `computed` |
| tsyringe | poslední vydání duben 2025 | vlastní malý kontejner |
| ts-events | poslední vydání únor 2022 | vlastní malá událost |
| jQuery | | nepoužívá se, v aplikaci jen kvůli Kendo |

**Důvody u tsyringe:** hlavní není stáří, ale cena za používání. Vyžaduje dekorátory a `reflect-metadata`, přitom vlastní kontejner vychází na pár desítek řádků a autowiring jde udělat čistěji (viz DI níže).

**Solid zůstává záložní plán**, ne výchozí volba. Potřebuje vlastní kompilátor JSX, což je v rozporu s cílem stát jen na TypeScriptu. Verze 2.0 je navíc ve stavu `rc`, takže by se teď stavělo na API těsně před změnou. Aplikace mají záviset jen na API PhloxJS (`state`, `computed`, `<If>`, `<For>`), aby případný přechod zůstal hlavně uvnitř jádra.

**Skutečně rizikový je jen renderer:** diamantové závislosti, automatický úklid a překreslování seznamů. Proto je u něj rozhodovací bod před převodem CMS (viz plán v `handoff.md`). Kontejner a události žádné takové riziko nenesou.

## DI a autowiring (rozhodnuto)

Závislosti se píšou do konstruktoru jako v Nette, bez dekorátorů a tokenů:

```ts
class UsersPresenter extends Presenter {
  constructor(private api: UserApi, private auth: Authorizator) { super(); }
}

const services = new Container().add(Http, UserApi, AppAuthorizator);
```

Služby se registrují (obdoba `services` v NEONu). Presentery a komponenty se neregistrují, vytváří je framework přes `container.create()`, jako `PresenterFactory` v Nette. Jejich základní služby (router, uživatel, flash) dodá framework zvlášť, takže `super()` je bez parametrů. Obdoba `injectPrimary` v Nette.

### Jak to funguje

TypeScript za běhu typy nezná, proto typy čte malý plugin pro Vite a do každé takové třídy doplní seznam závislostí:

```ts
static $inject = () => [UserApi, Authorizator];
```

Ten seznam je celé rozhraní mezi pluginem a kontejnerem. Bez pluginu jde napsat ručně, takže plugin není nutná podmínka a kontejner na něm nezávisí.

- **Hledání služby:** podle třídy nebo jejího abstraktního předka. Jedna shoda se použije, žádná nebo více shod je chyba, jako v Nette.
- **Funkce, ne pole:** kvůli cyklickým importům se seznam vyhodnotí až při vytváření.
- **Plugin čte jen syntaxi:** nepoužívá TypeScript compiler. TypeScript 7 nemá stabilní JS API (jen `typescript/unstable/*`), plugin by tak stál na nestabilním rozhraní.
- **Rozhraní nerozbije build:** typy se odkazují přes `import * as ns`. U interface je `ns.X` za běhu `undefined` a kontejner nahlásí chybu, až když má takovou třídu skutečně vytvořit. Běžné třídy jako `Point(x: number, y: number)` se to netýká.

### Rozdíly proti Nette

- **Rozhraní nejde autowirovat,** za běhu neexistují. Kontraktem je abstraktní třída: `abstract class Authorizator`, `class AppAuthorizator extends Authorizator`.
- **Generika se nerozliší:** `Repo<User>` a `Repo<Task>` jsou za běhu stejné. Plugin je označí jako neautowirovatelné.
- **Skalární parametry se nepředávají** (obdoba `%param%`). Konfigurace patří do služby, třeba `class AppConfig`.

### Stav

Implementováno: kontejner v `src/di/container.ts`, plugin v `src/di/vite.ts` (import `phlox-js/vite`, `phlox()` ve `vite.config.ts`). Pokrývají je `tests/di.test.ts`: autowiring, abstraktní předek, zděděný konstruktor, parametr s výchozí hodnotou, instance jako služba, `use()`, běžná třída beze změny a chyby pro interface, skalár, generikum, nejednoznačnost, chybějící službu a cyklus. V prohlížeči ověřeno na ukázce přes dev server i v produkčním buildu, soubory `.tsx` fungují.

**Známé nedostatky:**
- Build vypisuje varování `IMPORT_IS_UNDEFINED` u tříd s parametrem typu interface z jiného souboru.
- Po minifikaci jsou v chybách zkomolené názvy tříd.
- HMR (úprava souboru za běhu dev serveru) není ověřené.
- Framework se v repu plugin záměrně vyhýbá (`exclude`), aby se testoval stejný kód, jaký se bude publikovat.

### Konfigurace

Služby se definují v obyčejném TypeScript souboru, obdobě `config.neon`. Překlepy a přejmenování tak hlídá kompilátor a bundler vidí závislosti přes importy.

```ts
export const services = new Container()
  .add(Http, UserApi, AppAuthorizator)
  .add(new AppConfig({ apiUrl: import.meta.env.VITE_API_URL }))
  .use(rpcExtension);
```

- **Parametry** (`parameters`, `%param%`): služba `AppConfig`, hodnoty pro prostředí z `import.meta.env`.
- **Rozšíření** (`extensions`): funkce, které do kontejneru přidají své služby.

**Poznámka na později, teď se nedělá:** Vite plugin, který převede `.neon` na stejný kód. Kontejner se kvůli tomu nemění. Hodil by se třeba tehdy, kdyby CMS sdílelo konfiguraci s PHP.

## Oprávnění (rozhodnuto)

Přebírá se princip z Nette, ne kód z TraceJS: `User`, `Identity`, abstraktní `Authorizator` a `Permission` s rolemi, zdroji a privilegii.

**Implementováno** v `src/security/` (import `phlox-js/security`), testy `tests/permission.test.ts` a `tests/user.test.tsx`. Rozhodnutí při implementaci:

- **`Permission` hledá jako Nette:** zdroj před rodiči, role před rodiči (do hloubky, později přidaný rodič dřív) a před „všemi rolemi“, privilegium před „všemi privilegii“. Dotaz na všechna privilegia je kladný, jen když žádné konkrétní není zakázané. Neznámá role nebo zdroj je chyba.
- **`Identity` má navíc `token`.** V prohlížeči se uživatel serveru prokazuje tokenem (viz `TokenStorage` v `phlox-api-sample`), Nette ho v identitě nepotřebuje.
- **Výchozí úložiště je `sessionStorage`,** ne `localStorage`. Token tak nepřežije zavření panelu. Delší přihlášení je vědomá volba aplikace.
- **Bez `Authenticator` a `Authorizator`** v kontejneru doplní `Application` náhrady, které při použití vyhodí chybu s návodem. Jako v Nette, kde chybějící authorizator hlásí výjimku.
- **Ochrana presenterů je ve `startup()`,** žádný zvláštní mechanismus. Funguje, protože navigace se při `redirect()` vzdá dřív, než změní obrazovku.
- **Po přihlášení a odhlášení** se obrazovky nepřestaví samy. Šablony reagují (metody `User` čtou `state`), ale data načtená ve `startup()` by zůstala. Aplikace přesměruje nebo zavolá `app.restart()`.

## Formuláře (implementováno, čeká na review)

`src/forms/` (import `phlox-js/forms`), testy `tests/forms.test.tsx`. API podle `Nette\Forms`: `addText()`, `setRequired()`, `addRule()`, `addCondition()`, `addConditionOn()`, `elseCondition()`, `endCondition()`, `toggle()`, `onSuccess`, `onError`, `setValidationScope()`, `isSubmittedBy()`.

- **Typ hodnot je typový parametr:** `new Form<CreateTask>()` s DTO vygenerovaným z PHP (rozhodl autor). Názvy prvků i jejich druh hlídá kompilátor, `onSuccess` dostane DTO. Že formulář má prvek pro každé povinné pole DTO, kompilátor nezkontroluje.
- **Validace v prohlížeči je pro uživatele, rozhoduje server.** Chyby `-32602` z `phlox-rpc-api` (`fields`: cesta → zpráva) se ukážou u prvků, první část cesty (název parametru, třeba `input`) se odřízne. Pravidla se tedy píšou dvakrát, ale rozejití je jen nepohodlí. Převzít pravidla z OpenRPC (`required`, `minimum`, `enum`) je možné později.
- **Hodnoty mají tvar, jaký čeká DTO:** číslo nebo `null` u čísel, datum jako text `RRRR-MM-DD`, položky výběru s celočíselnými klíči jako čísla (jako pole v PHP).
- **Pravidla jen u vyplněného prvku, první chyba prvku, zakázaný prvek se nekontroluje** – stejně jako v Nette.
- **Výchozí hlášky jsou anglicky** jako v Nette a jdou přepsat přes `Form.messages`. `Translator` se do formuláře nepředává: s typovanými klíči si aplikace hlášky přeloží sama přes `t()`.
- **Kontrola během psaní** začne po opuštění pole nebo po první chybě. Dřív by uživatele rušila už u prvního písmene.
- **`toggle()`** přepíná atribut `hidden` u prvku s daným id, nejdřív ho hledá uvnitř formuláře.
- **`<form noValidate>`:** pravidla kontroluje formulář sám, bubliny prohlížeče by se s ním tloukly. Atribut `required` u prvků zůstává kvůli čtečkám obrazovky.
- **Rozšiřitelnost:** vlastní prvek je potomek `FormControl<T>` přidaný přes `addControl()`. Na tom budou stát combobox, dropdownlist a taginput, přepsané podle `phlox-combobox` a dalších (stejné CSS třídy, ovládání a ARIA, data přes funkci místo URL).

**Zatím chybí:** vnořené kontejnery (`addContainer()`) pro DTO s objekty a seznamy, nahrávání souborů a převzetí pravidel z OpenRPC.

## Síť: RPC (implementováno, čeká na review)

`src/net/` (import `phlox-js/net`): klient `RpcClient` pro `phlox-rpc-api` a generátor typů z OpenRPC.

- **Typy z dokumentu OpenRPC,** který `phlox-rpc-api` generuje při kompilaci kontejneru a publikuje na `/rpc/openrpc.json`. V PHP se tak nic nepřidává a typy vznikají ze stejného zdroje, podle kterého běží server. Generátor čte jen JSON Schema, kompilátor TypeScriptu nepotřebuje.
- **Vygenerovaný soubor obsahuje třídu `RpcApi extends RpcClient<RpcMethods>`.** Autowiring generika nerozliší, vlastní třída se dá najít podle typu.
- **`call('user.read', { id })`, ne `api.user.read({ id })`.** Odpovídá to JSON-RPC i `rpc.call` z Tracedu a nepotřebuje `Proxy`.
- **Automatické dávky:** volání v jednom okamžiku (do konce mikroúlohy) jdou jedním požadavkem. Server zpracuje každé zvlášť, chyba jednoho neovlivní ostatní.
- **Pojmenované parametry,** protože OpenRPC je popisuje jménem (`paramStructure: either`).
- **Data a časy se nepřevádějí,** zůstávají textem. Převod by potřeboval znát schéma za běhu.
- **Hlavičky jsou funkce,** aby se token četl při každém požadavku.
- **Generátor je skript pro Node** (`npm run rpc:types`), Node 22.18+ ho spustí bez překladu.

**Ověřeno naostro:** testy `tests/rpc-server.test.ts` proti spuštěnému `phlox-api-sample` (volání, dávka, chyby `-32601` a `-32602`). Generátor ze živé URL dal stejný výstup, jaký je uložený v `tests/fixtures/sample-rpc.ts`. Ty testy se bez proměnné `PHLOX_RPC_URL` přeskočí.

**Neověřeno:** autorizované metody (`x-authorize`) a token, protože ukázka má přes RPC jen veřejnou metodu `stats.tasks`. Přihlášení přes RPC tedy zatím není vyzkoušené proti skutečnému serveru.

Oprávnění v prohlížeči jen upravují UI: co se zobrazí a kam se dá přejít. Skutečnou kontrolu musí dělat server, protože kód v prohlížeči si uživatel může změnit.

## Překlady (rozhodnuto)

Vlastní malý překladač postavený na `Intl` v prohlížeči, odhadem kolem 50 řádků. Překlady jsou v JSON souborech a se serverem se nesdílejí. Kontraktem je abstraktní třída `Translator`, obdoba `Nette\Localization\Translator`, takže jde vyměnit, třeba za i18next.

**Co Tracedo potřebuje:** 1 022 volání `i18n.t` v 80 souborech. Parametry mají jen 2 z nich (stejný klíč), plurály ani dynamické klíče se v hledání neobjevily. Kód přitom nemá kontrolu klíčů: překlep se projeví až za běhu.

```ts
t('user.edit.title')          // klíč kontroluje kompilátor
t('user.greeting', { name })  // Ahoj {name}
t('cart.items', { count })    // plurál přes Intl.PluralRules
html('trial.exceeded')        // text s HTML, jen na výslovné vyžádání
```

Implementováno v `src/localization/translator.ts` (import `phlox-js/localization`) jako `Translator` a `IntlTranslator` (80 řádků), testy v `tests/i18n.test.ts`. `t` a `html` si aplikace exportuje ze svého překladače, viz `examples/shopping-list/i18n.ts`.

```json
{
  "user": { "edit": { "title": "Upravit uživatele" }, "greeting": "Ahoj {name}" },
  "cart": { "items": { "one": "{count} položka", "few": "{count} položky", "other": "{count} položek" } }
}
```

- **Kontrola klíčů:** typ klíčů se odvodí z výchozího JSONu. Ověřeno na datech z Tracedu (1 388 klíčů, TypeScript 7, kontrola 0,31 s): překlep i neúplný klíč jsou chyba kompilace.
- **Úplnost jazyků:** hlídá ji kompilátor, další jazyky musí mít typ výchozího: `Record<string, typeof cs>`.
- **Plurály:** `Intl.PluralRules` zná česká pravidla sám. Objekt s klíči `one`, `few`, `other` je plurál, typ klíčů s tím musí počítat.
- **Zástupné hodnoty:** jednotně `{name}`.
- **Čísla v parametrech** se formátují podle jazyka přes `Intl.NumberFormat`.
- **HTML:** `t()` vrací text, který se vkládá jako text. Pro texty s HTML je `html()`, které hodnoty parametrů escapuje a vrací uzly. V Tracedu má HTML 11 z 1 388 textů (`br`, `sup`, `strong`, `a`, `p`, `h1`) a `KnockoutHelpers.ts` vkládá přes `innerHTML` všechny.
- **Formáty:** čísla a data formátuje `Intl.NumberFormat` a `Intl.DateTimeFormat`. Tím odpadá `numeral` a formátování přes `moment` (v Tracedu dohromady 69 volání, část může být i počítání s daty, to je potřeba posoudit zvlášť).
- **Načítání:** každý jazyk je zvláštní soubor. Ukázka je importuje všechny najednou, přes `import()` jde stahovat jen ten použitý.
- **Chybějící překlad:** vrátí klíč a ve vývoji vypíše varování.
- **Změna jazyka:** `translator.setLocale()` a `app.restart()` přestaví strom presenterů od kořene a URL zůstane. `t()` tak může vracet obyčejný text a v šablonách není potřeba všude `() => t(...)`. Cenou je ztráta rozepsaných formulářů při změně jazyka.

**Převod ze stávajících souborů:** v Tracedu to jsou JS moduly s objektem (`locales/cs/app.js`), ne čisté JSON, ale převod je mechanický. Zástupné hodnoty se tam řeší dvěma způsoby: `__name__` přes i18next a `%sent%` přes ruční `.replace()`. Obojí se převede na `{name}`, v českých datech jde o pár textů. U CMS je potřeba formát ověřit.

**Co se vědomě neřeší:** ICU MessageFormat, jmenné prostory, kontexty a napojení na překladatelské služby. Kdyby byly potřeba, použije se i18next přes `Translator`.

## Životní cyklus a pojmy z Nette (rozhodnuto)

**Hlavní rozdíl:** v Nette žije presenter jeden požadavek, tady přežívá navigace. Z toho plyne většina odchylek v tabulce.

| Nette | PhloxJS | Kdy běží | Rozdíl proti Nette |
|---|---|---|---|
| `startup()` | `startup()` | jednou po vytvoření | v Nette při každém požadavku |
| `actionXxx()` | `actionXxx(params)` | při každé změně routy, jejích parametrů nebo persistentních parametrů | stejný účel: načíst data, přesměrovat. Nahrazuje `routeXxx` z TraceJS |
| `handleXxx()` | běžná metoda `handleXxx()` | po akci uživatele | jen konvence, bez URL a bez `?do=` |
| `beforeRender()` | není | | šablona se nevykresluje opakovaně, společné věci patří do `startup()` |
| `renderXxx()` | `render()` | jednou | vrací TSX, další změny obstará `state`. Různé pohledy podle routy řeší `<If when={() => this.route() === 'detail'}>` |
| `afterRender()` | `afterRender()` | po vložení do DOM | místo pro Kendo. Odpovídá `rendered()` z TraceJS, které přepisuje asi 50 souborů v Tracedu |
| `shutdown()` | `shutdown()` | při odstranění | nepovinné, `state`, vazby, posluchače a potomky uklidí framework sám |
| `createComponentXxx()` | `<UserList />` v TSX | | props kontroluje kompilátor |
| `link()`, `n:href` | `this.link()`, `<a href={...}>` | | |
| `redirect()` | `this.redirect()` | | neukončí metodu, píše se `return this.redirect(...)`. Výjimka by v obsluze události skončila jako neošetřená chyba |
| `error()` | `this.error(404)` | | vyhodí `BadRequestError` |
| `flashMessage()` | `this.flashMessage()` | | |
| `#[Persistent]` | `persistent()` | | zatím není implementováno |

Odpadá `configure()`, `bound()` a `queryChanged()` z TraceJS: `bound()` ani `queryChanged()` aplikace v Tracedu nepřepisuje a nastavení komponent nahrazují props.

### Ukázka

```tsx
class UsersPresenter extends Presenter {
  users = state<User[]>([]);

  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'detail', pattern: '/<id \\d+>', presenter: () => import('./UserDetailPresenter') },
  ];

  constructor(private api: UserApi) { super(); }

  async actionDefault({ page = '1' }: Params) {
    this.users.set(await this.api.list(Number(page)));
  }

  async handleDelete(id: number) {
    await this.api.delete(id);
    this.flashMessage(t('user.deleted'));
    this.redirect('this');
  }

  render() {
    return (
      <For each={this.users}>
        {user => <a href={this.link('detail', { id: user.id })}>{user.name}</a>}
      </For>
    );
  }
}
```

### Routy

- **Presenter je přímo u routy,** i s líným načtením přes `import()`. Odpadá ruční `switch` s `loadRouteFrame`, který je dnes v `defaultRoute` u `Main.tsx` a `Settings.tsx`.
- **Parametry** dostane `actionXxx` jako objekt. Převod typů (`Number(id)`) se upřesní při implementaci.
- **Pořadí:** navigace jde stromem shora dolů a stará obrazovka zůstává vidět, dokud nová nedoběhne. Běží vždy jedna navigace, poslední čekající vyhrává.

### Odkazy

Místo tvarů se dvojtečkou z `routeTo` jsou tři jednoduché: `link('detail', { id })` na routu presenteru, `link('this', { page: 2 })` na aktuální stránku a `link('/settings/users')` absolutně. Výsledkem je skutečná URL v `<a href>`, kliknutí zachytí router. Funguje tak otevření v novém panelu, což `href="#"` z Tracedu neumí. Podoba parametrů přes více úrovní se upřesní při implementaci.

### Persistentní parametry (zatím není implementováno)

Dnes dostane query parametry akce koncového presenteru a mění se přes `link('this', { page: 2 })`. Návrh:

`page = persistent('page', 1)` je `state` svázaný s query parametrem URL.

- **Typ** se odvodí z výchozí hodnoty, nesmyslná hodnota z URL se změní na výchozí.
- **Výchozí hodnota** se do URL nepíše, jako v Nette.
- **`0` a prázdný text** jsou platné hodnoty (regresní test na chybu z TraceJS).
- **Změna** je navigace jako v Nette: zapíše se do historie a znovu spustí aktuální akci. Pro psaní do filtru je volba bez zápisu do historie.
- **Platnost:** parametr žije, dokud je jeho vlastník ve stromu.
- **Stejný název** u dvou živých vlastníků je ve vývoji chyba.

**Neověřeno praxí:** aplikace v Tracedu persistentní parametry nepoužívá (v `client/src` není `configurePersistentParameters`) a autor je v JS nejspíš nepoužil. Návrh vychází z Nette. První ověření přinese kanban a podle něj se upraví nebo odloží.

### `<view-frame>` (rozhodnuto)

Pojmenovaný `<view-frame>` a `loadViewFrame()` nahrazuje přímé použití komponenty v TSX. `<route-frame />` zůstává jako komponenta `<RouteFrame />`.

```tsx
// Tracedo: rámec v šabloně, načtení v kódu, nastavení bez typové kontroly
await this.loadViewFrame<GridConfigurator>(GridConfigurator, 'gridconf', { grid, name });

// PhloxJS
<GridConfigurator grid={this.grid} name="User.Management" />
```

Props tak kontroluje kompilátor a výměnu řeší `<If>` nebo `state`. Přístup k instanci komponenty zajistí `ref`.

## Aplikace, presentery, router a dialogy (implementováno, čeká na review)

Kód: `ui/component.ts`, `ui/presenter.ts`, `ui/dialog.ts`, `application/router.ts`, `application/application.ts`. Použití popisuje [guide.md](guide.md). Tady jsou rozhodnutí, která vznikla až při implementaci, a jejich důvody.

### Komponenty

- **`render()`, `title()` a `actions()` jsou metody,** ne pole s funkcí. TypeScript nedovolí, aby potomek přepsal metodu polem, takže musí být jeden tvar. Metoda je bližší Nette.
- **Props a služby jdou každé svou cestou.** Konstruktor patří službám (autowiring), props jsou v `this.props` už od začátku konstruktoru, takže fungují i v inicializátorech polí. Framework je předává stranou při vytváření, proto komponentu nejde vytvořit přes `new`.
- **Async `startup()`:** view vložené komponenty se objeví, až `startup()` doběhne. U presenteru na něj čeká navigace.
- **`afterRender()`** běží o mikroúlohu později než vložení do stránky, prvky už jsou v dokumentu.
- **Rodič a aplikace se dědí přes `Scope`.** Šablony se vytvářejí líně, takže „kdo mě právě vykresluje“ nejde zjistit z pořadí volání. Scope proto umí nést hodnoty (`provide`, `find`).

### Router

- **Vzor routy bez `$`.** Routa s `presenter` nebo `dialog` bere začátek URL a zbytek předá dál, jiná routa musí sedět celá. `/` znamená „nic dalšího“, prázdný vzor nebere nic a předá vše (hodí se pro layout).
- **Presenter bez rout** je jedna stránka s akcí `actionDefault()`.
- **Query parametry dostane presenter, jehož routa nemá potomka,** tedy konec řetězu, jako jediný presenter v Nette. Změna query tak nespouští akce rodičů.
- **Kdy se co spouští znovu:** akce při změně routy nebo jejích parametrů. Potomek se vytvoří znovu, když se změní routa nebo parametry jeho rodiče. Jinak by `/users/5/orders` → `/users/6/orders` nechalo na obrazovce objednávky uživatele 5.
- **Navigace je nedělitelná.** Nové presentery a dialogy se připraví stranou (včetně `startup()` a akcí) a stránka se změní až na konci. Když cokoli selže, stará obrazovka zůstane a chybu dostane `app.onError`. Platí i pro první načtení: selže-li, zůstane jen layout.
- **Jedna navigace najednou.** Novější čeká, běžící se vzdá při nejbližším kroku. Akce téhož presenteru se tak nikdy nepřekrývají. `redirect()` z běžící navigace převezme její záměr zapsat do historie, takže mezikrok v historii nezůstane.
- **Neznámá URL** volá `notFound(path)` presenteru, u kterého hledání skončilo. Výchozí vyhodí `BadRequestError(404)`.
- **`redirect()` znovu spustí akci** volajícího presenteru a presenterů pod ním, i když se URL nezměnila. Proto funguje `redirect('this')` po smazání.
- **Odkazy přes více úrovní:** `link('název')` umí routy vlastního presenteru. Hlouběji vede absolutní cesta nebo `link()` cílového presenteru.

### Dialogy

- **Okno dodává služba `Dialogs`,** výchozí `NativeDialogs` používá `<dialog>`. Kendo adaptér ji v kontejneru nahradí.
- **Routovaný dialog** se zavírá přes `history.back()`, pokud je v historii předchozí záznam aplikace (pozná se podle čítače v `history.state`). Jinak se URL nahradí cestou presenteru.
- **Dialog z dialogu:** routovaný dialog, který je `Presenter`, zpracuje zbytek URL svými routami, takže jeho routa může otevřít další dialog. Router pro to nemá zvláštní větev. Ověřeno testy (tři úrovně, Zpět, přímý odkaz, přechod mezi úrovněmi) a v ukázce v prohlížeči. Autor to potřebuje pro CMS.
- **`closed` dostane každý zavřený dialog,** i když zmizí s dialogem pod sebou nebo s presenterem, ze kterého se odchází. Zavírá se od nejvyššího dolů. Dřív se to dělo jen u dialogu, jehož vlastní routa se změnila, a vnořené dialogy o svém zavření nevěděly.
- **Dialog, jehož `startup()` selže,** zruší celou navigaci (viz nedělitelnost). Odkaz na smazaný záznam má ošetřit akce presenteru nebo dialog sám.

### Co zatím chybí

- Persistentní parametry.
- Zadržení odchodu s neuloženými změnami.
- Aplikace v podadresáři (base path) a práce s `#hash`.

## Reaktivní jádro a renderer (implementováno, čeká na review)

Kód je v `src/`, ukázka v `examples/shopping-list`. Spuštění: `npm test`, `npm run typecheck`, `npm run dev`.

### Reaktivní jádro (`reactive/reactive.ts`)

```ts
const count = state(1);
const double = computed(() => count() * 2);
effect(() => console.log(double()));
count.set(2);
```

**Jak aktualizace probíhá:** změna `state` označí přímé odběratele jako `DIRTY` a vzdálenější jako `CHECK` a zařadí efekty do fronty. Efekt pak před spuštěním zkontroluje své zdroje v pořadí, v jakém je četl, a přepočítá se, jen když se některý skutečně změnil. Díky tomu:

- **Diamant** se přepočítá jednou a nikdy neuvidí nekonzistentní hodnoty.
- **Stejný výsledek `computed`** zastaví šíření změny.
- **Větev, která už neplatí,** se nevyhodnotí.

**Pořadí efektů:** rodiče před potomky. Potomek se tak nikdy nespustí nad daty, která rodič právě odstraňuje.

**Úklid:** vše patří do `Scope`. Každý efekt je zároveň scope, před dalším spuštěním uklidí své vnořené efekty a `onCleanup`. Autor view nic uklízet nemusí.

**Chyby:**
- Selhaný efekt nezastaví ostatní, chyba dojde k tomu, kdo změnu vyvolal.
- Chyba v `computed` se pamatuje a dostanou ji všichni čtenáři, po změně vstupu se zotaví.
- Selhaný úklid se jen zaloguje.
- Cyklus v `computed`, zápis do stavu z `computed` a nekonečná smyčka efektů jsou chyba.

**Explicitní `state`, ne automaticky reaktivní pole (rozhodl autor):** pole třídy by šla udělat reaktivní přes `Proxy` jako ve Vue nebo MobX. Zamítnuto, protože bez kompilátoru by se šablony prodloužily (`{() => this.draft}` místo `{this.draft}`), zapomenutá funkce by byla tichá chyba, vnořené objekty a pole by přidaly do jádra stovky řádků a z kódu by nebylo poznat, co je reaktivní. Možný pozdější doplněk: pomocník pro převod celé struktury z API na `state` a zpět (obdoba `ko.mapping`), postavený nad `state`.

### Renderer (`ui/dom.ts`, `ui/jsx.ts`)

Bez virtuálního DOMu: `h()` vrací jen šablonu (předpis). Skutečné uzly se vytvoří jednou, až při vložení šablony do stránky, a změny pak jdou přímo do uzlů, které na nich závisí. Funkce (i `state`, který je funkcí) v atributu nebo potomkovi je reaktivní.

**Proč šablona, a ne rovnou uzly:** TSX bez kompilátoru vyhodnotí potomky dřív než rodiče. Kdyby `h()` tvořilo uzly hned, vytvořila by se i skrytá větev `<If>` se všemi efekty. Se šablonou se nic nevytvoří a žádná komponenta nespustí, dokud se obsah opravdu nevkládá. Rozhodl autor kvůli zápisu `<If>` bez funkcí.

- **`<div />` není DOM prvek.** Skutečný prvek dá `ref` nebo `afterRender()`.
- **Každé vložení je nová instance,** stejnou šablonu lze vložit vícekrát.
- **Efekty vznikají při vložení,** tedy vždy v rozsahu, který je uklidí.

- **Atributy:** `false`, `null` a `undefined` atribut odstraní. Výjimkou jsou `aria-*`, `data-*`, `draggable`, `contenteditable` a `spellcheck`, kde je `false` skutečná hodnota.
- **Vlastnosti DOM:** `value`, `checked`, `selected`, `muted` a `indeterminate` se nastavují jako vlastnosti, atribut drží jen počáteční hodnotu.
- **Typy** se odvozují z DOM typů TypeScriptu. Chybí `innerHTML` a podobné, `className` nahrazuje `class`.
- **Text** se nikdy neparsuje jako HTML.
- **`render()`** staví view bokem, takže při selhání nic nezůstane v DOM (regrese z TraceJS).
- **Bez importu `h`:** používá se automatický JSX runtime (`jsx: react-jsx`, `jsxImportSource: phlox-js`), takže soubory s TSX neimportují `h` ani `Fragment`. Kompilátor si sám importuje `src/jsx-runtime.ts`, což je tenký obal nad `h()`. V repu se `phlox-js` převádí na `src/` přes `paths` v `tsconfig.json`, Vite je čte díky `resolve.tsconfigPaths`. Až se balíček bude publikovat, musí `jsx-runtime` a `jsx-dev-runtime` uvést v `exports`.

**Zatím nepodporováno:** SVG. Prvky `<svg>` kompilátor odmítne, takže to neselže potichu. Doplní se, až bude potřeba.

### `<If>` a `<For>` (`ui/flow.ts`)

**`<If>`** se píše jako `{if} … {elseif} … {else} … {/if}` v Latte. `<ElseIf />` a `<Else />` jsou oddělovače větví:

```tsx
<If when={user}>
  <Profile />
<ElseIf when={loading} />
  <Spinner />
<Else />
  <Login />
</If>
```

- **Jen zobrazená větev existuje:** vytvoří se a vloží do DOM jen první větev se splněnou podmínkou. Skrytá větev se z DOM odstraní a uklidí, při dalším zobrazení vznikne znovu.
- **Přestavba jen při přepnutí větve,** ne při každé změně hodnoty podmínky.
- **Podmínka musí být `state` nebo funkce:** `when={user}` nebo `when={() => items().length > 0}`. Zápis `when={items().length > 0}` by se vyhodnotil jednou, kompilátor ho odmítne.
- **Hodnota podmínky bez `!`:** funkce v první větvi ji dostane jako parametr: `<If when={user}>{u => <b>{() => u().name}</b>}</If>`.
- **Chyby:** `<Else />` nebo `<ElseIf />` mimo `<If>` a větev za `<Else />` jsou chyba za běhu.

**`<For>`** má dva režimy:

```tsx
// Bez key: řádek patří objektu (porovnání identitou), položka je obyčejná hodnota
<For each={items}>{item => <li>{item.name}</li>}</For>

// S key: řádek přežije nový objekt se stejným klíčem, položka je funkce
<For each={items} key={item => item.id}>{item => <li>{() => item().name}</li>}</For>
```

`key` je pro data znovu načtená ze serveru, kde každé načtení vrací nové objekty. Bez něj by se přestavěly všechny řádky.

**Přesuny:** řádky ze stávajícího pořadí, které zůstávají ve správném sledu (nejdelší rostoucí podposloupnost), se nedotknou. Přesunutý uzel by ztratil fokus a pozici rolování.

### První měření

10 000 řádků (50 001 prvků), v každém 3 buňky, 2 reaktivní vazby a posluchač. Headless Edge, dev server, jedno měření. Orientační hodnoty, rozhodovací test před CMS tím není nahrazený.

| Operace | JS | S vykreslením |
|---|---|---|
| Vytvoření | 191 ms | 801 ms |
| Změna jednoho řádku | do 1 ms | 46 ms |
| Změna všech řádků po jednom | 17 ms | 19 ms |
| Prohození dvou řádků | 6 ms | 48 ms |
| Otočení seznamu | 47 ms | 501 ms |
| Přidání jednoho řádku | 4 ms | 50 ms |
| Smazání všech | 70 ms | 76 ms |

Většinu času u velkých změn zabere vykreslení v prohlížeči, ne JS.

Tabulka je z verze, kde `h()` tvořilo uzly hned. Po přechodu na šablony vyšla dvě měření v rámci rozptylu (vytvoření 183 a 198 ms JS, 806 a 830 ms s vykreslením), měřitelné zpomalení se neukázalo.
