# PhloxJS: návrh

Jak se pojmy z Nette převádějí do PhloxJS. Dokument vzniká postupně. Každá část říká, jestli je rozhodnutá, nebo čeká na autora.

## Struktura kódu (rozhodnuto)

Adresáře `src/` odpovídají jmenným prostorům Nette:

| Adresář | Obsah | V Nette |
|---|---|---|
| `reactive/` | `state`, `computed`, `effect`, `Scope` | |
| `ui/` | `Component`, `Presenter`, `RouteFrame`, šablony, `<If>`, `<For>`, dialogy, témata | `Nette\Application\UI` |
| `styles/` | `base.css` (rozložení), `default.css` (výchozí téma) | |
| `application/` | `Application`, `Router`, flash zprávy | `Nette\Application`, `Nette\Routing` |
| `di/` | `Container`, Vite plugin pro autowiring | `Nette\DI` |
| `localization/` | `Translator`, `IntlTranslator` | `Nette\Localization` |
| `forms/` | `Form`, prvky, pravidla, vykreslení | `Nette\Forms` |
| `components/` | samostatné widgety: `Tree`, později grid a kanban | |
| `adapters/` | napojení cizích knihoven: `adapters/capify` (flash zprávy přes `@phloxcz/capify`), později `adapters/kendo` | |
| `net/` | RPC klient a generátor typů | |
| `security/` | `User`, `Identity`, `Permission` | `Nette\Security` |

- **Šablony jsou v `ui/`,** ne zvlášť jako obdoba Latte. Jsou s komponentami těsně propojené (rozhodl autor).
- **Flash zprávy:** `flashMessage()` je metoda presenteru jako v Nette, služba, která zprávy drží, patří k aplikaci.

**Importy:** `phlox-js` dává to, co potřebuje každá obrazovka (reaktivita, šablony, komponenty, presentery, aplikace, DI). Volitelné části mají vlastní vstup: `phlox-js/net`, `phlox-js/security`, `phlox-js/forms`, `phlox-js/components`, `phlox-js/localization`, `phlox-js/vite` a adaptéry (`phlox-js/adapters/capify`, později `phlox-js/adapters/kendo`).

**`components/`** (rozhodl autor): velké volitelné widgety jako strom, později grid podle `phlox-grid` a kanban. Název odpovídá PHP knihovnám `phloxcz/components-*`. Do `ui/` nepatří, protože to je jádro, které importuje každá obrazovka, a do `forms/` taky ne, protože to nejsou formulářové prvky. Formulářové prvky postavené na nich (`addTreeSelect`) jsou ve `forms/` a widget si berou z `components/`. Pro projekty s licencí Kendo zůstane `phlox-js/adapters/kendo`.

## Vzhled a témata (rozhodnuto)

Vlastní CSS framework ani pevná vazba na Bootstrap. Postup je stejný jako u `phlox-dropdownlist` a `capify`: malé CSS pro rozložení, výchozí vzhled se systémovými barvami a témata jako mapa tříd.

- **`Theme`** je služba v kontejneru (`src/ui/theme.ts`): místo (`input`, `dialogHeader`...) → třídy. Výchozí téma dává `phlox-*`, `BootstrapTheme` třídy Bootstrapu 5 (rozhodl autor: zatím jen tyto dvě). Tailwind nebo Foundation se přidají jako další mapa, komponenty se nemění. Místa jsou textové klíče, takže vlastní prvky a adaptéry si přidají svá (`dropdownlist.wrapper`).
- **Téma dostanou vykreslované prvky přes `Scope`** (`THEME`, `currentTheme()`), jako aplikace. Mimo aplikaci platí výchozí.
- **CSS:** `styles/base.css` (rozložení pro každé téma) a `styles/default.css` (vzhled výchozího tématu). Systémové barvy následují `color-scheme` stránky, takže výchozí téma ztmavne, jen když stránka tmavý režim povolí. Barva chyby proto používá `light-dark()`, ne `prefers-color-scheme`: na světlé stránce v tmavém systému by byla nečitelná.
- **Bootstrap a nativní `<dialog>`:** třídy `modal-content`, `modal-header`... berou barvy a odsazení z proměnných, které Bootstrap definuje jen na obalu `.modal`. Ten u `<dialog>` být nemůže (dělá vlastní pozicování), a okno pak nemělo pozadí. Téma proto používá utility (`bg-body`, `p-3`, `border-bottom`...), které na ničem nezávisí. Ověřeno snímky z prohlížeče.
- **Třída předaná do `<Input>`** se přidá k třídě tématu, u tlačítka ji nahradí (jinak by `btn-primary` a `btn-secondary` platily naráz).

### Animace (implementováno, čeká na review)

`ui/motion.ts`, testy `tests/motion.test.tsx`. Přání autora: jeden třístavový přepínač pro všechny prvky, i budoucí.

- **`setMotion('on' | 'off' | 'system')`, výchozí `'system'`.** Globální stav, ne služba v kontejneru: animace jsou vlastnost stránky pro uživatele, ne jedné aplikace, a CSS stejně potřebuje atribut na `<html>`. Volbu ukládá aplikace, framework nic neukládá.
- **JS se ptá `allowsMotion()`,** CSS násobí délku proměnnou `--phlox-motion` (1 nebo 0). Jedna konvence pro oba světy: nový prvek ji dodrží a přepínač platí i pro něj bez úprav. `--phlox-motion` počítá `base.css` z atributu `data-phlox-motion` a z media query `prefers-reduced-motion`, takže `'system'` funguje i bez JS.
- **`'on'` přebije i systém,** jen pro animace frameworku. Bootstrap si omezení pohybu hlídá sám a do jeho přechodů framework nesahá.
- **Kolečko načítání se točí vždy:** je to ukazatel stavu, ne ozdoba. Proto se nenásobí.

### Tmavý režim s Bootstrapem

Ověření autora ukázalo černá tlačítka rozbalení ve stromu na světlé Bootstrap stránce v tmavém systému. CSS převzaté z `phlox-tree` používá systémovou barvu `Canvas`, která se řídí `color-scheme`, ne `data-bs-theme`. Části v `base.css`, které kreslí pozadí, proto berou `var(--bs-body-bg, Canvas)`: s Bootstrapem jeho barvu, ve výchozím tématu systémovou. Zaškrtávátka výběru ze stromu dostávají v Bootstrapu `form-check-input` (místo tématu `tree.pick`). Stránka má mít `color-scheme` shodné s `data-bs-theme`, ukázky to nastavují v `examples/shared/appearance.tsx`.

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

**DropDownList** (`forms/dropdownlist.tsx`, testy `tests/dropdownlist.test.tsx`) je přepsaný podle `phlox-dropdownlist`: stejné HTML, třídy obou témat, CSS a ovládání klávesnicí. Rozdíly a důvody:

- **Data:** místo URL dostane `items` nebo funkci `search` (typicky RPC) a pro popisek uložené hodnoty `label`. Server tak nemusí mít signál pro každý výběr.
- **Navíc `aria-activedescendant`, `aria-controls` a `aria-selected`,** aby čtečka obrazovky hlásila zvýrazněnou položku.
- **Panel `position: fixed`** podle tlačítka, ne `absolute`: modální `<dialog>` má `overflow: auto` a panel by ořízl. Ověřeno v prohlížeči.
- **Otočení nahoru** (přání autora): strana se volí podle plné výšky seznamu, ne podle právě zobrazených položek, takže panel při psaní neskáče. Nahoře je panel ukotvený spodním okrajem (`bottom`), aby zůstal u tlačítka, když se seznam zkrátí. Když se nevejde nikam, zkrátí se seznam. Výška musí počítat i s odsazením a okrajem seznamu, jinak panel přesahoval okno o pár pixelů. To ukázalo až měření v prohlížeči.
- **Hledání v pevných položkách bez ohledu na diakritiku** (`foldText`). Odhalilo to ověření v prohlížeči: „nap“ nenašlo „Nápoje“.
- **Zavírání a kontrola podle `focusout` celého prvku,** ne podle `blur` tlačítka. Jinak by se při otevření seznamu hned ukázala chyba povinného pole.
- **Výchozí texty anglicky** jako hlášky pravidel, PHP verze má česky.

**ComboBox** (`forms/combobox.tsx`, testy `tests/combobox.test.tsx`) je přepsaný podle `phlox-combobox`: stejné třídy obou témat a stejné chování (hodnota je vybraná položka, `allowCustom` pro napsaný text, Escape vrací předchozí hodnotu).

- **Společná třída `ListControl`** (`forms/listbox.tsx`) pro dropdownlist a combobox: položky, hledání bez diakritiky, vykreslení seznamu, šipky a umístění panelu včetně otočení nahoru. Kód se neopakuje a oprava platí pro oba.
- **Přesný název se vybere sám,** i v jiné velikosti písmen nebo bez diakritiky. PHP verze napsaný text bez výběru zahodí.
- **Escape jen v otevřeném seznamu.** V zavřeném poli ho dostane dialog, jinak by šel dialog s comboboxem zavřít jen myší.
- **Předchozí hodnota pro Escape se pamatuje i na začátku psaní,** ne jen při získání fokusu. Ověření v prohlížeči ukázalo, že po výběru a novém psaní Escape vracel prázdnou hodnotu.
- **Napsaný text se ustálí ve `validate()`,** takže Enter, který odešle formulář dřív, než pole ztratí fokus, pracuje se správnou hodnotou. Stejný problém řeší PHP verze posluchačem `submit`.
- **`allowCustom` jen pro textová pole:** typ `addComboBox` ho jinde nedovolí.
- **Výchozí vzhled v systémových barvách** jako zbytek výchozího tématu. `combobox.css` v PHP knihovně má pevné barvy a vlastní tmavý režim přes `prefers-color-scheme`, který na světlé stránce v tmavém systému nesedí. Třídy jsou stejné, takže by stálo za to sjednotit CSS i v `phlox-combobox`.

**TagInput** (`forms/taginput.tsx`, testy `tests/taginput.test.tsx`) je přepsaný podle `phlox-taginput`: stejné třídy obou témat, CSS a ovládání (Enter, čárka, Backspace, šipky dokola, „Vytvořit:“). Rozdíly:

- **Hodnota je `T[]`,** nové štítky jsou texty. `getSplitValue()` je dělí jako PHP. Příznak „nový“ PHP posílá serveru zvlášť (`{v, n}`), v SPA ho má prvek u sebe.
- **`allowNew` je ve výchozím stavu vypnuté** (v PHP zapnuté), protože ho typ `addTagInput` dovolí jen u seznamu textů. Seznam ID by jinak výchozím nastavením přestal sedět na typ.
- **Duplicity bez ohledu na diakritiku** (`foldText`), PHP porovnává jen velikost písmen.
- **Nedopsaný text se převede na štítek při odeslání formuláře, ne při opuštění pole.** Ověření v prohlížeči ukázalo, že převod při opuštění pole o řádek zvětší formulář, tlačítko Uložit pod myší poskočí a klik skončí jinde.
- **Panel se umisťuje stejně jako u dropdownlistu** (`placePanel` z `listbox.tsx`), podle obalu se štítky.
- **Výchozí barvy štítků** přes `light-dark()` podle `color-scheme` stránky, PHP má `prefers-color-scheme`. Pro Bootstrap je navíc zvýraznění fokusu na obalu, protože fokus je v poli uvnitř `form-control`.

**Předvybraná hodnota ze vzdálených dat:** `setValue(value, label)` přijme popisek, když ho data ze serveru mají (bez dotazu navíc, jako PHP verze při vykreslení). Uložená hodnota se v seznamu bez hledaného textu ukáže první, i když ji `search` nevrátil (třeba za limitem 100 záznamů).

**Enter ve formuláři bez tlačítka pro odeslání:** prohlížeč odešle formulář Enterem jen s tlačítkem pro odeslání nebo s jediným textovým polem. Formulář v dialogu má Uložit v patičce, mimo `<form>`, a s druhým polem přestal Enter fungovat (zjištěno v prohlížeči). `FormTag` proto Enter v textovém poli odešle sám, pokud ho nevyužil prvek (výběr v seznamu volá `preventDefault`) a formulář nemá vlastní tlačítko.

**Přechod z pole na tlačítko nekontroluje.** Ověření v prohlížeči ukázalo, že chyba objevená při `blur` posune tlačítko Uložit a klik se ztratí (`mousedown` na tlačítku, `mouseup` vedle). Uživatel musel klikat dvakrát. Když fokus přechází na tlačítko (`relatedTarget`), kontrola se vynechá. Odeslání zkontroluje vše a jiná tlačítka (posun řádku) nechají kontrolu na příští opuštění pole.

### Kontejnery a řádky (implementováno, čeká na review)

`forms/container.ts`, `forms/multiplier.ts`, `ui/sortable.ts`, testy `tests/multiplier.test.tsx` a `tests/sortable.test.tsx`. Podle `Nette\Forms\Container` a `contributte/forms-multiplier`.

- **`Form extends Container`** jako v Nette. Všechny metody `add*()` jsou v `Container`, `Form` přidává jen odeslání, tlačítka, chyby formuláře a chyby ze serveru. Dosavadní API formuláře se nezměnilo.
- **Vlastník (`Owner`)** dává členům tři věci: formulář, začátek id (`frm1-lines-3-quantity`) a `name` (`lines[3][quantity]`). Kontejner, multiplikátor i formulář jsou vlastníci, takže vnoření je libovolně hluboké bez zvláštních případů.
- **Řádek je `Container`,** multiplikátor drží pole řádků ve `state`. Hodnoty, kontrola, `setValues`, `reset`, hledání podle cesty ze serveru a fokus první chyby jsou rekurzivní metody se stejným názvem na kontejneru i multiplikátoru.
- **Klíč řádku v id a `name` je pořadové číslo vzniku, ne index.** Při přesunu se nemění, takže `<For>` bez `key` přesune celý prvek i s rozepsaným textem a fokusem a id zůstanou jedinečná. Pořadí v hodnotách dává pole řádků. Cesta ze serveru (`lines.2.quantity`) naopak index je, protože server vidí pole.
- **`setValues` řádky znovu použije,** jen přidá nebo ubere chybějící. Prvky se nevykreslují znovu, když se data načtou podruhé.
- **`min` a `max` hlídají tlačítka i kontrola.** Chyba počtu patří multiplikátoru, ne formuláři, aby se ukázala u řádků (a aby na ni šla poslat chyba ze serveru `input.lines`).
- **Typy:** `addContainer` přijme jen název objektu, `addMultiplier` jen název seznamu objektů. `setDefaults` bere `DeepPartial` DTO, protože výchozí hodnoty bývají neúplné.
- **Tažení přes pointer events, ne HTML5 drag & drop.** HTML5 DnD nefunguje na dotykových zařízeních, tažený obrázek nejde stylovat a událostí je hodně. Pointer events pokryjí myš, pero i prst stejným kódem a celé řazení je asi 50 řádků.
- **Položka se přesouvá v datech už během tažení,** šablona přesune prvek. Nic se nekreslí dvakrát a puštění nic nepřepočítává. Pozice se volí podle středu tažené položky proti středům ostatních, takže položky různé výšky fungují.
- **Tažená položka jede volně za ukazatelem** (přání autora, i vodorovně): `transform: translate` je rozdíl mezi místem pod ukazatelem a místem v rozvržení. Po každém přesunu v datech se dopočítá znovu, takže položka neposkočí. Ostatní uhýbají animací FLIP (`Element.animate`, 150 ms) a puštěná položka dosedne stejnou animací. Bez klonu prvku: tažený je skutečný řádek, takže si drží rozepsaný text i fokus. Tažená položka je neprůhledná, průhledná nechávala prosvítat text pod sebou.
- **Posluchače jsou na `window`, ne `setPointerCapture()` na úchytu.** Ověření v prohlížeči ukázalo, že přesun prvku v DOM capture uvolní a zbytek tažení se ztratí (řádek se posunul jen o jedno místo a zůstal ve stavu tažení).
- **Klávesnice:** šipky na úchytu a tlačítka ↑ ↓. Fokus zůstává na úchytu, takže jde řádek posunout o víc míst za sebou. Tlačítka pro posun mají i uživatelé bez myši a čteček, kterým tažení nic neřekne.
- **`dragToSort` je samostatná funkce v `ui/`,** ne součást formulářů. Použije ji i kanban.
- **Posouvání u okraje** (přání autora): posouvá se nejbližší předek s `overflow: auto/scroll`, který má co posouvat, jinak stránka. Formulář v dialogu tak posouvá dialog, ne stránku pod ním. Smyčka běží přes `requestAnimationFrame` po celou dobu tažení, protože ukazatel u okraje stojí a `pointermove` nechodí. Po posunu se položka znovu umístí a zařadí. Meze posunu se berou před tažením: posunutá položka obsah zvětšuje a ověření v prohlížeči ukázalo, že by se jinak posouvalo donekonečna.
- **Rozložení `vertical`, `horizontal` a `grid`** se liší jen tím, jak se porovnají středy: podle `y`, podle `x`, nebo v pořadí čtení (řádek výš, nebo stejný řádek a vlevo). Pohyb položky na rozložení nezávisí. `lockAxis` je pro ty, kdo pohyb mimo osu nechtějí; výchozí je volný pohyb jako v běžných knihovnách typu SortableJS.
- **Rozvržení polí v řádku je v `base.css`** (flex se zalamováním), ne v tématu. Bootstrap utility `flex-grow-1` bez základní šířky pole skládaly pod sebe.

### Soubory (implementováno, čeká na review)

`forms/upload.tsx`, `net/files.ts`, testy `tests/upload.test.tsx`.

- **Prvek jen vybírá, nenahrává** (rozhodl autor). Hodnota jsou objekty `File`, přenos řeší `onSuccess`: v CMS po částech v base64 přes RPC, jinde proudem do REST API. Prvek tak nezávisí na serveru, stejně jako `addUpload()` v Nette jen předá `FileUpload`.
- **Jen nové soubory** (rozhodl autor). Existující přílohy záznamu upload neukazuje, hodnota by jinak byla směs `File` a ID a obsluha by potřebovala i seznam smazaných.
- **Vzhled převzatý z `phlox-upload`:** drop zóna s ikonou a tlačítkem, tabulka souborů, třídy `pu-*` a Bootstrap mapa tříd. Vynechaný je průběh, stavy a tlačítka Nahrát a Zrušit, protože se tu nic nenahrává. Bootstrap nemá `border-dashed`, který PHP knihovna používá, proto je definovaný v `base.css`.
- **Zóna je tlačítko pro klávesnici** (`role="button"`, Enter, mezerník), tlačítko uvnitř má `tabindex="-1"`, aby nebyly dvě zastávky na totéž. `id` má skutečný `<input type="file">`, takže `<Label>` otevře dialog. Fokus po chybě dostane zóna.
- **Pravidla po souborech:** `MaxFileSize`, `MimeType` a `Image` platí pro každý soubor. Kvůli označení chybného souboru v seznamu mají kontrolu jednoho souboru (`fileChecks`) a `Rules.active()` vrací pravidla, která právě platí, i z podmínek. Počet souborů hlídá `MinLength`/`MaxLength` jako v Nette.
- **`accept` z pravidel** jako v Nette (`MimeType`, `Image`). Je reaktivní, takže sleduje i podmínky.
- **Kontrola hned po výběru,** ne až po opuštění prvku. Výběr je jedna akce, ne psaní, a uživatel chce hned vědět, že soubor nevyhovuje.
- **Náhled obrázku přes `URL.createObjectURL`,** adresa se uvolní, když soubor opustí seznam (úklid řádku `<For>`).
- **`fileChunks` je v `net/`,** ne ve formulářích: dělí jakýkoli `Blob` a s prvkem nesouvisí. Čte po částech přes `slice()`, takže velký soubor není v paměti celý. Převod na base64 jde po 32 KB, `String.fromCharCode()` s celým megabajtem argumentů by přetekl zásobník.

### Rozbalovací výběr ze stromu (implementováno, čeká na review)

`forms/dropdowntree.tsx`, testy v `tests/tree.test.tsx`. Přání autora: zavřený ukazuje cestu k uzlu, otevřený strom jako dropdownlist.

- **Vzhled a panel dropdownlistu:** stejné třídy tématu a `placePanel` (umístění `fixed`, otočení nahoru). Ve sbaleném stavu vypadá jako ostatní výběry ve formuláři.
- **Strom v režimu výběru, ne zaškrtávání:** `tree.selected` je hodnota a `onSelect` panel zavře. Klávesnice stromu tak funguje i v panelu bez úprav.
- **Cesta je `computed` nad stavem stromu,** takže sleduje i `reload()` a přejmenování. Když uzel ve stromu není, prvek si ho najde přes `reveal()` (`path`). Hledání běží v `effect` při vykreslení, ne v `setValue`, aby fungovalo i po `reload()`.
- **Vymazání křížkem a klávesou Delete** jen u nepovinného prvku. Dropdownlist k tomu má prázdnou položku, strom žádnou „prázdnou“ větev nemá.
- **Jen jeden uzel.** Více uzlů v rozbalovacím panelu by potřebovalo v tlačítku ukázat několik cest, na to je lepší strom přímo ve formuláři (`addTreeMultiSelect`).

### Výběr ze stromu (implementováno, čeká na review)

`forms/treeselect.tsx`, testy v `tests/tree.test.tsx`. Jako picker `phloxcz/components-tree` (`setSelectable`): strom přímo ve formuláři s přepínači nebo zaškrtávátky, ne rozbalovací seznam.

- **Hodnota je id** (`addTreeSelect`) nebo pole id (`addTreeMultiSelect`), typ podle DTO. Zaškrtnutí jsou nezávislá jako v PHP: rodič neznamená děti.
- **Prvek drží vlastní `Tree` v režimu `pick`.** Strom tak umí všechno co jinde (líné načítání, `path`, klávesnice) a `checked` stromu je hodnota prvku.
- **Klik kamkoli na řádek** zaškrtne, jako v PHP. Větší plocha pro klik.
- **Vybrané uzly hluboko v líném stromu** se ukážou přes `path`, jako `setCheckedNodes` v PHP.
- **Fokus po chybě** jde na `role="tree"` a ten ho předá vybranému nebo prvnímu uzlu.

**Zatím chybí:** převzetí pravidel z OpenRPC.

## Grid (implementováno, čeká na review)

`components/grid.ts` (model), `components/gridview.tsx` (vykreslení), testy `tests/grid.test.tsx`, ukázka `examples/grid`. Podle `phloxcz/components-grid` (`phlox-grid`): stejné třídy `phx-grid-*`, Bootstrap mapa, CSS bez pevných barev a funkce (řazení ve třech stavech, hledání, filtry text, výběr, vícenásobný výběr, rozsah, ano a ne, výběr ze serveru, stránky s volbou počtu, akce na řádku a v menu, hromadné akce, součty, šířka, pořadí a viditelnost sloupců).

- **Dotaz ve formátu phloxcz/api-query** (rozhodl autor), tedy Kendo UI: grid jde napojit rovnou na API bez převodu. Data v prohlížeči zpracuje `applyQuery()` stejnými pravidly, takže lokální grid a serverový se chovají stejně a ukázka v ní má „server“.
- **Součty ve formátu Kendo** (`aggregate` v dotazu, `aggregates` v odpovědi). phlox-api-query je zatím neumí; formát Kendo je pro jejich doplnění na serveru nejpřirozenější. PHP grid je počítá nad celým vyfiltrovaným výběrem, ne nad stránkou, a stejně tak tady.
- **Sloupce řetězením metod** jako v PHP a ve formulářích, názvy hlídá kompilátor podle typu řádku. Obsah buňky je šablona, ne HTML text jako v PHP.
- **Filtr v URL jako text** (`f.price=100..300`, `f.category=Knihy,Sport`): čitelný odkaz. Na typ ho převede sloupec (číslo, ano a ne, hodnota položky).
- **Změny jdou přes URL,** když je grid svázaný (`bind`): kliknutí naviguje, router změní parametry a grid podle nich načte. Jeden směr toku dat, Zpět a Vpřed tak fungují bez další logiky.
- **Šířky:** první změna změří všechny sloupce naráz a přepne tabulku na `table-layout: fixed` s šířkou rovnou součtu. Ověření v prohlížeči ukázalo dvě chyby: s šířkou 100 % se volné místo rozdělilo mezi sloupce a sloupec rostl méně, než se táhlo; a měření po jednom přepnulo rozložení dřív, než se změřily ostatní sloupce. Buňky mají `box-sizing: border-box`, jinak výchozí téma (bez globálního `border-box` jako Bootstrap) přičetlo k šířce odsazení.
- **Tažení sloupců a změna šířky** stojí na `ui/drag.ts` jako řazení a strom: posun u okraje, Escape zruší. Tažení začne po 5 px, kratší pohyb je klik a řadí. Pro klávesnici jsou v menu Sloupce tlačítka ← →.
- **Panely (filtry, menu, sloupce) `fixed`** a zarovnané do okna: v `table-responsive` s `overflow-x` by je `absolute` ořízlo.
- **Potvrzení přes `Grid.confirm`,** ve výchozím stavu `window.confirm`, aby šel napojit dialog aplikace nebo capify bez závislosti gridu na nich.
- **Ikony jsou malé SVG** v kódu, PHP verze čeká Bootstrap Icons, které framework nemá.
- **Předvolby (uložené stavy) z PHP verze nejsou:** stav je v URL, takže předvolbou je záložka nebo odkaz. Když budou potřeba pojmenované, dají se doplnit nad URL a `localStorage`.

**Kde je stav (rozhodl autor):**

- **V URL:** stránka, řazení, hledání a filtry, tedy „na co se dívám“. Odkaz jde poslat a ukáže totéž, Zpět a Vpřed vracejí předchozí stav, obnovení stránky ho drží.
- **V `localStorage`:** šířka a pořadí sloupců, tedy „jak to mám rád“. Je to osobní nastavení, do odkazu nepatří a platí napříč záložkami.
- **Žádné záložní obnovení ze `sessionStorage`:** seznam otevřený odkazem bez parametrů (z menu) začíná čistý. Úložiště by se s URL přetahovalo: Zpět by vrátilo jinou URL, ale stejný uložený stav.

## Strom (implementováno, čeká na review)

`components/tree.ts` (model), `components/treeview.tsx` (vykreslení), `ui/drag.ts` (společný základ tažení), testy `tests/tree.test.tsx`, ukázka `examples/tree`. Podle `phloxcz/components-tree`: stejné HTML, třídy `pt-*`, CSS bez pevných barev, Bootstrap mapa a chování (líné načítání, čáry, pamatování rozbalení, přetahování před, za a dovnitř, návrat po chybě, picker).

- **Model a vykreslení zvlášť** jako `Form` a `FormView`. Presenter volá `tree.select(id)` z akce, formulář drží vlastní strom a test pracuje s modelem bez DOM.
- **Data přes funkce** `load(parent)` a `path(id)`, ne přes URL signálů. Stejně jako `search` u dropdownlistu: strom nezávisí na serveru a volá RPC, REST nebo cokoli.
- **Výběr podle URL dělá router, ne strom.** PHP verze čte id z URL sama (`setUrlParam`, `setUrlPattern`) a napojuje se na Naja kvůli Zpět a Vpřed. Tady má popisek `href`, akce presenteru volá `tree.select(id)` a o Zpět a Vpřed se postará router. `select()` z kódu nevolá `onSelect`, jinak by výběr z URL znovu navigoval.
- **Stav je reaktivní** (`expanded`, `children`, `parent` každého uzlu). Přesun je změna dat a šablona se překreslí sama. Návrat po chybě znamená jen vrátit uzel v datech, PHP verze musela obnovit DOM včetně ikon a přechodů mezi listem a větví. Proto je kód asi o polovinu kratší.
- **Sbalené děti nejsou v DOM** (PHP je skrývá přes `display: none`). Velký rozbalovaný strom tak nedrží tisíce skrytých prvků.
- **Animace výšky přes `Element.animate`** (přání autora). Při sbalení děti zůstanou v DOM, dokud animace neskončí, a teprve pak zmizí. Přerušená animace se zastaví a nová jede z dosažené výšky: ověření v prohlížeči ukázalo, že jinak běžely dvě najednou. Délka je z `--pt-anim-duration` jako v PHP, `prefers-reduced-motion` ji vypne a první vykreslení se neanimuje (obnovené rozbalení by jinak při načtení stránky „naskakovalo“).
- **Klávesnice podle WAI-ARIA:** jedna zastávka tabulátoru (roving tabindex), šipky, Home, End, `*` a psaní pro skok na uzel. PHP verze má `tabindex="0"` u každého uzlu, takže se tabulátorem prochází celý strom.
- **Tažení přes pointer events,** ne HTML5 drag & drop jako v PHP, ze stejných důvodů jako `dragToSort`: jde stylovat a běží i perem. Kopie řádku jede vedle ukazatele, ne přes něj: ověření v prohlížeči ukázalo, že kopie přímo pod ukazatelem zakryje cílový řádek i ukazatel místa. Tažení začne až po posunu o 4 px, aby klik zůstal klikem, a klik po puštění se zahodí, aby nevybral uzel pod ukazatelem.
- **Prstem po podržení** (přání autora). Strom nemá úchyt a `touch-action: none` na řádcích by zablokovalo posouvání stránky tahem přes strom. Prst proto musí 0,4 s stát (do 8 px), jinak jde o posouvání a tažení nezačne. Po začátku tažení se `touchmove` ruší (`preventDefault`, posluchač s `passive: false`), takže stránka se pod prstem nehne a ukazatel dál posílá `pointermove`. Nabídka prohlížeče po podržení (`contextmenu`) a bublina iOS (`-webkit-touch-callout`) jsou potlačené. Ověřeno skutečnými dotykovými událostmi přes CDP: rychlý tah posouvá, podržení a tah přesune.
- **Přesun do nenačteného uzlu** ho nejdřív načte, aby se uzel zařadil mezi skutečné děti.
- **Uložení po přesunu** (`move`) dostane i nového rodiče a pozici, nejen cíl a polohu jako v PHP. Server tak nemusí pozici dopočítávat.
- **`ui/drag.ts`** je společný základ `dragToSort` a stromu: jeden ukazatel, posluchače na `window`, posouvání u okraje a nově Escape, který tažení zruší a nezavře dialog kolem.
- **Pamatování rozbalení v `localStorage`** pod klíčem `phlox-tree:<remember>` jako v PHP. Uzly pod sbaleným rodičem si stav nechávají a otevřou se, až se rodič rozbalí.

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

### Persistentní parametry (implementováno, čeká na review)

`persistent: string[]` na presenteru, čte je `Router.link()`. Testy v `tests/router.test.tsx`. Vznikly pro grid (rozhodl autor: obecně pro presentery, ne jen pro grid).

- **Jen seznam názvů, ne typovaný `state` na parametr,** jak navrhoval původní text tady. Stav a jeho převod z textu má ten, kdo parametry používá (grid, akce presenteru), framework jen zařídí, aby je odkazy nesly. Je to menší a nemíchá dvě místa, kde by žil tentýž stav.
- **Platí pro odkazy presenteru a presenterů pod ním** na jejich routy, jako v Nette pro odkazy na stejný presenter. `link('this')` nesl celé query už předtím, absolutní cesta neopouští aktuální presenter jen náhodou, a proto nenese nic.
- **Název s `*`** (`'f.*'`) kvůli filtrům gridu, jejichž názvy závisejí na sloupcích.
- **Zavření routovaného dialogu po přímém odkazu** vede na URL presenteru s jeho persistentními parametry. Jinak by se grid pod dialogem vrátil na první stránku bez filtrů.
- **Výchozí hodnoty do URL nepíše ten, kdo parametr nastavuje** (grid vynechá `page=1`), framework hodnoty nezná.

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
