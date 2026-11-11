# PhloxJS: příručka

Jak se s frameworkem pracuje. Popisuje jen to, co je už napsané a otestované. Proč je co navržené tak, jak je, najdeš v [design.md](design.md).

**Co zatím chybí:** persistentní parametry a adaptér pro Kendo.

**Kde co je:** jádro (reaktivita, šablony, komponenty, presentery, aplikace, DI) se importuje z `phlox-js`. Volitelné části mají vlastní vstup: síť (RPC) `phlox-js/net`, přihlášení a oprávnění `phlox-js/security`, formuláře `phlox-js/forms`, překlady `phlox-js/localization` a Vite plugin `phlox-js/vite`. Napojení cizích knihoven (adaptéry) jsou pod `phlox-js/adapters/…`.

Všechno níže je vidět pohromadě v ukázce [examples/shopping-list](../examples/shopping-list/main.ts).

## Spuštění

| Příkaz | Co dělá |
|---|---|
| `npm run dev` | spustí ukázku |
| `npm test` | spustí testy |
| `npm run typecheck` | zkontroluje typy |

## Jak se pojmy z Nette jmenují tady

| Nette | PhloxJS |
|---|---|
| `Bootstrap`, `Application` | `new Application(services).run(...)` |
| `services` v `config.neon` | `new Container().add(...)` v `services.ts` |
| autowiring konstruktoru | stejně, zařídí ho Vite plugin `phlox()` |
| `Presenter` | `Presenter` |
| `Control`, `createComponentXxx()` | `Component`, v šabloně `<UserList />` |
| `startup()`, `actionXxx()`, `handleXxx()` | stejně |
| `renderXxx()` a Latte šablona | `render()` vrací TSX |
| `{if}`, `{foreach}` | `<If>`, `<For>` |
| `link()`, `n:href`, `redirect()`, `error()`, `flashMessage()` | stejně |
| `Translator`, `{_'klíč'}` | `Translator`, `t('klíč')` |
| `$this->user`, `User`, `SimpleIdentity` | `this.user`, `User`, `Identity` |
| `Authenticator`, `Authorizator`, `Permission` | stejně |
| volání API kontroleru z `phlox-rpc-api` | `await this.api.call('user.read', { id })` |
| `Nette\Forms\Form`, `addText()`, `addRule()`, `onSuccess` | stejně, `new Form<Dto>()` |
| `{form}`, `{label}`, `{input}`, `{inputError}`, `{control form}` | `<FormTag>`, `<Label>`, `<Input>`, `<InputError>`, `<FormView>` |

**Hlavní rozdíl:** v Nette žije presenter jeden požadavek. Tady žije, dokud je na obrazovce, a obrazovku tvoří strom presenterů, mezi které se dělí URL.

## Aplikace a bootstrap

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
- **`app.presenter`** je kořenový presenter, **`app.router`** router, **`app.flashes`** flash zprávy, **`app.user`** přihlášený uživatel.

Projekt potřebuje ve `vite.config.ts` plugin kvůli autowiringu a v `tsconfig.json` nastavení TSX (viz Šablony):

```ts
import { phlox } from 'phlox-js/vite';

export default defineConfig({ plugins: [phlox()] });
```

## Služby a DI

Služby se registrují na jednom místě, jako v `config.neon`:

```ts
// services.ts
export const services = new Container()
  .add(UserApi, AppAuthorizator)            // třída: vytvoří se, až ji někdo potřebuje
  .add(new AppConfig({ apiUrl: '/api' }))   // hotová instance
  .use(rpcExtension);                       // rozšíření: funkce, která přidá své služby
```

Kdo službu potřebuje, napíše si ji do konstruktoru. Platí to pro služby, presentery i komponenty:

```ts
class UsersPresenter extends Presenter {
  constructor(private api: UserApi, private auth: Authorizator) {
    super();
  }
}
```

- **Služba se hledá podle typu,** i podle abstraktního předka. `Authorizator` výše najde zaregistrovaný `AppAuthorizator`. Když typu nevyhovuje žádná služba nebo jich vyhovuje víc, je to chyba.
- **Presentery a komponenty se neregistrují,** vytváří je framework.
- **Kontraktem je abstraktní třída, ne `interface`.** Rozhraní za běhu neexistují, takže podle nich hledat nejde.
- **Čísla a texty do konstruktoru nepatří.** Nastavení zabal do služby, třeba `AppConfig`.
- **Generika se nerozliší:** `Repo<User>` a `Repo<Task>` jsou za běhu stejná třída.

Bez pluginu jde závislosti zapsat ručně: `static $inject = () => [UserApi, Authorizator];`.

## Komponenty

Komponenta je třída se stavem, životním cyklem a šablonou. V šabloně se použije jako značka.

```tsx
class UserCard extends Component<{ userId: number }> {
  user = state<User | null>(null);

  constructor(private api: UserApi) {
    super();
  }

  override async startup() {
    this.user.set(await this.api.get(this.props.userId));
  }

  render() {
    return <article>{() => this.user()?.name}</article>;
  }
}

// použití, props hlídá kompilátor
<UserCard userId={15} />
```

| Metoda | Kdy běží |
|---|---|
| `startup()` | jednou po vytvoření, před vykreslením. Může být `async`, view se pak objeví, až doběhne |
| `render()` | jednou. Vrací šablonu, další změny dělá `state` |
| `afterRender()` | jednou, když je view ve stránce. Místo pro widgety, které potřebují skutečné prvky |
| `shutdown()` | při odstranění. Nepovinné, `state`, efekty a posluchače se uklidí samy |

- **Props** jsou první typový parametr a čtou se z `this.props`. Dostupné jsou už v inicializátorech polí. Obsah mezi značkami přijde jako `this.props.children`.
- **Konstruktor je jen pro služby.** Komponentu nejde vytvořit přes `new`, vytváří ji framework.
- **Instanci** dostaneš přes `ref`: `<UserCard userId={15} ref={card => { this.card = card; }} />`.
- **`this.parent`** je komponenta nebo presenter, ve kterém je použitá.
- **Funkce jako komponenta** stačí pro kousek šablony bez vlastního stavu: `const Icon = (props: { name: string }) => <i class={props.name} />`.

## Presentery a routy

Presenter je komponenta, na kterou vede URL. Každý presenter si z URL vezme svůj díl a zbytek předá presenteru pod sebou. Ten se zobrazí v místě `<RouteFrame />`.

```tsx
class AppPresenter extends Presenter {
  override routes: Route[] = [
    { name: 'about', pattern: '/about', presenter: () => import('./AboutPresenter') },
    { name: 'users', pattern: '/users', presenter: UsersPresenter },
  ];

  render() {
    return (
      <div>
        <nav>
          <a href={this.link('users')} class={() => (this.route() === 'users' ? 'active' : '')}>Uživatelé</a>
        </nav>
        <RouteFrame />
      </div>
    );
  }
}

class UsersPresenter extends Presenter {
  users = state<User[]>([]);

  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'detail', pattern: '/<id \\d+>', presenter: UserDetailPresenter },
  ];

  constructor(private api: UserApi) {
    super();
  }

  async actionDefault({ page = '1' }: Params) {
    this.users.set(await this.api.list(Number(page)));
  }

  render() { /* seznam a <RouteFrame /> pro detail */ }
}
```

URL `/users/15/orders` se rozdělí takto: `AppPresenter` vezme `/users`, `UsersPresenter` vezme `/15` a `UserDetailPresenter` dostane `/orders`.

### Routy

- **`name`** určuje akci: routa `detail` volá `actionDetail(params)`. Akce je nepovinná.
- **`pattern`** je díl URL. Parametr se píše `<id>` nebo s regulárním výrazem `<id \d+>`. Routy se zkoušejí v pořadí, první vyhovující vyhrává.
- **`presenter`** je presenter pro `<RouteFrame />`. Funkce s `import()` ho načte, až když je potřeba. Soubor pak musí třídu exportovat jako `default`.
- **Routa s `presenter` bere začátek URL,** routa bez něj musí sedět na celý zbytek.
- **`/`** znamená „nic dalšího“. Prázdný vzor `''` nebere nic a všechno předá dál, hodí se pro layout.
- **Presenter bez rout** je jedna stránka a jeho akce je `actionDefault()`.
- **`routes` potřebuje typ `Route[]`,** jinak TypeScript neodvodí typy parametrů ve funkcích uvnitř.

### Akce a parametry

- **Parametry jsou texty:** `actionDetail({ id })` dostane `'15'`, na číslo si ho převeď.
- **Query parametry** (`?page=2`) dostane presenter na konci řetězu, tedy ten, jehož routa nemá `presenter`. Parametr routy má při stejném názvu přednost.
- **Akce běží,** když se změní routa nebo její parametry. Když zůstanou stejné, presenter i jeho stav zůstávají.
- **Presenter pod routou se vytvoří znovu,** když se změní parametry routy nad ním. Přechod z `/users/5/orders` na `/users/6/orders` tedy vytvoří nový `UserDetailPresenter`.
- **`this.route()` a `this.params()`** jsou `state` s aktuální routou a parametry, jdou použít v šabloně.
- **Co má být načtené vždy, patří do `startup()`,** ne do akce. Akce jiné routy se při přímém odkazu nespustí.

### Odkazy a přesměrování

```tsx
this.link('detail', { id: 5 })            // /users/5: routa tohoto presenteru
this.link('detail', { id: 5, tab: 'a' })  // /users/5?tab=a: co není v routě, jde do query
this.link('this', { page: 2 })            // aktuální URL se změněným query, null parametr odebere
this.link('/about')                       // absolutní cesta

<a href={this.link('detail', { id: user.id })}>{user.name}</a>
```

Odkaz je obyčejné `<a href>`. Kliknutí zachytí aplikace a přejde bez načtení stránky, otevření v novém panelu funguje normálně. Odkaz s `target` nebo `download` a odkaz na jiný web nechá prohlížeči.

`link('název')` zná jen routy vlastního presenteru. Do hlubší úrovně vede absolutní cesta, nebo `link()` zavolaný na cílovém presenteru.

```ts
async handleDelete(id: number) {
  await this.api.delete(id);
  this.flashMessage('Smazáno.');
  this.redirect('this');          // znovu spustí akci, i když se URL nezměnila
}

actionOld() {
  return this.redirect('users');  // rozdíl proti Nette: redirect metodu neukončí, napiš return
}
```

- **`this.error(404)`** ukončí akci chybou `BadRequestError`, dostane ji `app.onError`.
- **Neznámá URL** zavolá `notFound(path)` na presenteru, kde hledání skončilo. Výchozí chování je `error(404)`. Přepiš ji, pokud chceš ukázat vlastní stránku nebo přesměrovat.
- **`app.router.navigate('/users')`** přejde na URL z kódu mimo presenter.

### Jak probíhá navigace

- **Stará obrazovka zůstává, dokud nová není připravená.** Nové presentery se vytvoří stranou, proběhne jejich `startup()` a akce, a teprve pak se obrazovka vymění.
- **Když cokoli selže, nezmění se nic** a chybu dostane `app.onError`.
- **Běží jen jedna navigace.** Když uživatel klikne jinam dřív, než doběhne, vyhrává poslední kliknutí.

## Dialogy

V dialogu se dá otevřít jakákoli komponenta. Sama určuje titulek a tlačítka a zavírá se přes `this.close(výsledek)`. Typ výsledku je druhý typový parametr.

```tsx
class UserEdit extends Component<{ userId: number }, boolean> {
  name = state('');

  constructor(private api: UserApi) {
    super();
  }

  override async startup() {
    this.name.set((await this.api.get(this.props.userId)).name);
  }

  override title() {
    return 'Úprava uživatele';
  }

  override actions() {
    return (
      <>
        <button onClick={() => this.close(false)}>Zrušit</button>
        <button onClick={() => this.handleSave()}>Uložit</button>
      </>
    );
  }

  async handleSave() {
    await this.api.save(this.props.userId, this.name());
    this.close(true);
  }

  render() {
    return <input value={this.name} onInput={event => this.name.set(event.currentTarget.value)} />;
  }
}
```

### Dialog bez URL

Pro potvrzení, výběr nebo krátký formulář. `openDialog` počká na zavření a vrátí výsledek:

```ts
const saved = await this.openDialog(UserEdit, { userId: 15 });
if (saved) await this.reload();
```

Zavření křížkem nebo klávesou Escape vrátí `undefined`. Dialog zmizí i s komponentou, která ho otevřela.

### Dialog s URL

Deklaruje se u routy. Na `/users/15` zůstane vidět seznam a nad ním se otevře dialog. Dá se na něj odkázat a tlačítko Zpět ho zavře.

```ts
override routes: Route[] = [
  { name: 'default', pattern: '/' },
  {
    name: 'edit',
    pattern: '/<id \\d+>',
    dialog: ({ id }) => [UserEdit, { userId: Number(id) }],
    closed: saved => {
      if (saved) void this.reload();
    },
  },
];
```

```tsx
<a href={this.link('edit', { id: user.id })}>Upravit</a>
```

- **`closed`** dostane to, co dialog předal do `close()`. Když ho zavřela navigace (tlačítko Zpět, jiný odkaz), dostane `undefined`.
- **Zavření vrátí URL zpět:** uvnitř aplikace krokem zpět v historii, po příchodu přímým odkazem nahrazením URL.
- **Seznam pod dialogem načítej ve `startup()`.** Po přímém odkazu na dialog se `actionDefault()` nespustí.
- **Když `startup()` dialogu selže,** selže celá navigace. Odkaz na smazaný záznam proto ošetři v akci presenteru (`actionEdit`) nebo v dialogu.
- **`closed` se zavolá vždy,** i když dialog zmizí proto, že se zavřel dialog pod ním nebo se odešlo z presenteru.

### Dialog z dialogu

Dialog, který je `Presenter`, má vlastní routy, a ty mohou otevřít další dialog. Každá úroveň přidá kus URL. V ukázce je to úprava položky (`/5`) → historie změn (`/5/history`) → detail změny (`/5/history/1`):

```ts
// Seznam: /5 otevře úpravu
{ name: 'edit', pattern: '/<id \\d+>', dialog: ({ id }) => [ItemEdit, { id: Number(id) }] }

// ItemEdit extends Presenter<{ id: number }, boolean>: /5/history otevře historii nad ní
override routes: Route[] = [
  { name: 'default', pattern: '/' },
  { name: 'history', pattern: '/history', dialog: () => [ItemHistory, { id: this.props.id }], closed: () => void this.loadName() },
];

// ItemHistory extends Presenter<{ id: number }>: /5/history/1 otevře detail změny
override routes: Route[] = [
  { name: 'default', pattern: '/' },
  { name: 'change', pattern: '/<index \\d+>', dialog: ({ index }) => [ChangeDetail, { id: this.props.id, index: Number(index) }] },
];
```

```tsx
<a href={this.link('history')}>Historie</a>        // uvnitř ItemEdit vede na /5/history
```

- **Odkazy uvnitř dialogu** míří na routy jeho presenteru, `this.link('history')` tedy doplní `/history` za `/5`.
- **Zavření nejvyššího dialogu** vrátí URL o úroveň níž a jeho výsledek dostane `closed` routy o úroveň níž. Tlačítko Zpět zavírá dialogy jeden po druhém.
- **Přímý odkaz** `/5/history/1` otevře všechny tři naráz. Zavírání pak nahrazuje URL úroveň po úrovni.
- **Přechod na nižší úroveň** zavře dialogy nad ní. Odchod jinam zavře všechny, každý `closed` dostane `undefined`.
- **Data pod dialogem znovu načti v `closed`,** i bez výsledku. Uživatel mohl změnu udělat ve vyšším dialogu a pak se vrátit tlačítkem Zpět.
- **Nativní `<dialog>` je modální,** ovládat jde jen ten nahoře. Dialogy pod ním jsou neaktivní, dokud se horní nezavře.

### Vzhled a výměna okna

Výchozí okno je nativní `<dialog>` s částmi `header`, tělem a `footer`. Třídy mu dává téma (viz Vzhled a témata), u výchozího tématu `phlox-dialog`, `phlox-dialog-header` a další.

Okno dodává služba `Dialogs`. Jinou implementaci, třeba nad Kendo Window, zaregistruješ v kontejneru: `services.add(KendoDialogs)`.

## Flash zprávy

```ts
this.flashMessage('Uloženo.', 'success');                     // v presenteru
this.flashMessage('Hotovo.', 'info', { duration: 2000 });     // vlastní doba
```

- **Typy:** `info`, `success`, `warning`, `error`.
- **Zprávy samy mizí** po 5 sekundách. Chyby zůstávají, dokud je uživatel nezavře, aby je nepřehlédl. Pro celou aplikaci se to nastaví na službě: `app.flashes.duration = 3000`, `app.flashes.errorDuration = 10000` (0 = nezmizí sama).
- **Rozdíl proti Nette:** tam zpráva přežije přesměrování a ukáže se na další stránce. V SPA se stránka nepřenačítá, takže zprávy fungují jako toasty.

### Zobrazení přes capify

Doporučené: zprávy jako toasty knihovny [capify](https://github.com/phloxcz/capify), které se skládají na sebe, mají odpočet, pauzu při najetí myší a křížek.

```ts
// services.ts
import * as Capify from '@phloxcz/capify';
import '@phloxcz/capify/capify.css';
import { CapifyFlashMessages } from 'phlox-js/adapters/capify';

services.add(new CapifyFlashMessages(Capify, { position: 'top-right', theme: 'bootstrap' }));
```

Druhý parametr jsou volby `Capify.notify()` pro všechny zprávy. `phlox-js` sám capify nevyžaduje, instaluje ho aplikace (`npm i @phloxcz/capify`).

### Zobrazení v layoutu

Bez adaptéru drží zprávy výchozí služba v `app.flashes.messages` a layout si je vykreslí sám:

```tsx
<For each={this.app.flashes.messages}>
  {flash => (
    <p class={`flash ${flash.type}`} role="status">
      {flash.text}
      <button type="button" aria-label="Zavřít" onClick={() => this.app.flashes.remove(flash)}>×</button>
    </p>
  )}
</For>
```

## Vzhled a témata

Framework vykresluje formuláře a okna dialogů. Jaké třídy dostanou, určuje téma. CSS framework si nevnucuje.

```ts
// main.ts: rozložení pro každé téma, k tomu vzhled
import 'phlox-js/styles/base.css';
import 'phlox-js/styles/default.css';          // výchozí téma
```

```ts
// nebo s Bootstrapem 5
import 'phlox-js/styles/base.css';
import 'bootstrap/dist/css/bootstrap.min.css';

services.add(new BootstrapTheme());              // services.ts
```

- **Výchozí téma** (bez registrace) dává třídy `phlox-*` a `default.css` jim dává vzhled. Používá systémové barvy prohlížeče jako ostatní komponenty phlox. S `:root { color-scheme: light dark; }` na stránce ztmavne se systémem, bez něj zůstane světlé. Barvy a zaoblení jdou změnit proměnnými `--phlox-error`, `--phlox-radius` a `--phlox-backdrop`.
- **`BootstrapTheme`** dává Bootstrap třídy (`form-control`, `form-select`, `is-invalid`, `invalid-feedback`, `btn btn-primary`...) a o vzhled i tmavý režim se stará Bootstrap. `default.css` se nenačítá.
- **`base.css`** je jen rozložení (šířka okna dialogu, skrývání přes `toggle()`), potřebuje ho každé téma.
- **Změna jednotlivých tříd:** `new BootstrapTheme({ formRow: 'row mb-2' })`.
- **Ukázka** přepne na Bootstrap parametrem `?theme=bootstrap` při načtení stránky.

### Vlastní téma

Téma je mapa „místo → třídy“. Jiný CSS framework (Tailwind, Foundation...) je jen další mapa:

```ts
class FoundationTheme extends Theme {
  constructor() {
    super({ input: '', error: 'form-error is-visible', invalid: 'is-invalid-input', button: 'button' });
  }
}
services.add(new FoundationTheme());
```

| Místo | Kde |
|---|---|
| `form`, `formRow`, `formErrors`, `formButtons` | `<FormView>` |
| `label`, `input`, `select`, `textarea`, `button` | prvky formuláře |
| `invalid`, `error` | prvek s chybou, text chyby |
| `checkbox`, `checkboxInput`, `radioList`, `checkboxList`, `choiceItem`, `choiceInput` | checkboxy a výběry |
| `dialog`, `dialogContent`, `dialogHeader`, `dialogTitle`, `dialogClose`, `dialogBody`, `dialogFooter` | okno dialogu |

Místo, které téma nemá, dostane prázdnou třídu. Vlastní prvky si mohou zavést svá místa, třeba `dropdownlist.wrapper`, a číst je přes `currentTheme().class('dropdownlist.wrapper')`.

## Adaptéry: napojení jiných knihoven

Části, které jdou vyměnit, jsou služby v kontejneru. Adaptér je třída, která službu nahradí: zaregistruješ ji v `services.ts` a framework ji použije místo výchozí. Presentery a komponenty se nemění.

| Služba | Výchozí | K čemu adaptér |
|---|---|---|
| `FlashMessages` | zprávy pro layout, s časovačem | `CapifyFlashMessages` (`phlox-js/adapters/capify`), jiná knihovna toastů |
| `Dialogs` | nativní `<dialog>` | okna jiné knihovny, třeba Kendo Window |
| `Theme` | výchozí třídy `phlox-*` | `BootstrapTheme`, jiný CSS framework |
| `Translator` | `IntlTranslator` | i18next nebo jiný překladač |
| `UserStorage` | `sessionStorage` | `localStorage`, cookies |
| `Authenticator`, `Authorizator` | žádný, chyba při použití | přihlášení a oprávnění aplikace |
| `FormControl` | prvky formulářů | widgety jiné knihovny jako prvky formuláře |

Vlastní adaptér pro jinou knihovnu toastů:

```ts
class ToastifyFlashMessages extends FlashMessages {
  override add(text: string, type = 'info', options: FlashOptions = {}): Flash {
    Toastify({ text, className: type, duration: options.duration ?? this.duration }).showToast();
    return { text, type };
  }
}

services.add(ToastifyFlashMessages);
```

Adaptér, který knihovnu dostane v konstruktoru (jako `CapifyFlashMessages`), nemá na knihovnu závislost a dá se otestovat s falešnou náhradou.

## Překlady

Texty jsou v JSON souboru pro každý jazyk. Aplikace si vytvoří překladač a vyveze z něj funkci `t`:

```ts
// i18n.ts
import { IntlTranslator } from 'phlox-js/localization';
import cs from './locales/cs.json';
import en from './locales/en.json';

export const locales: Record<string, typeof cs> = { cs, en };   // en musí mít stejné klíče jako cs
export const translator = new IntlTranslator('cs', cs);
export const { t, html } = translator;
```

```json
{
  "user": { "greeting": "Ahoj {name}" },
  "cart": {
    "items": { "one": "{count} položka", "few": "{count} položky", "other": "{count} položek" }
  }
}
```

```tsx
t('user.greeting', { name: 'Jano' })   // Ahoj Jano
t('cart.items', { count: 3 })          // 3 položky
t('user.greting')                      // chyba kompilace, takový klíč není

<p>{() => t('cart.items', { count: this.count() })}</p>
```

- **Klíče hlídá kompilátor** podle JSON souboru výchozího jazyka.
- **Plurál** je objekt s tvary `one`, `few`, `many`, `other`. Tvar se vybere podle parametru `count` a pravidel jazyka z `Intl.PluralRules`. `other` je povinný a použije se, když potřebný tvar chybí.
- **Čísla** v parametrech se formátují podle jazyka: `1 234,5` česky, `1,234.5` anglicky.
- **Chybějící text** vrátí klíč a vypíše varování do konzole.
- **`t()` vrací text,** který se do stránky vkládá vždy jako text. Pro texty obsahující HTML je `html()`: `<p>{html('about.text')}</p>`. HTML v překladu se použije, hodnoty parametrů se escapují.
- **Reaktivní je překlad jen ve funkci.** `{t('x')}` se přeloží jednou, `{() => t('x', { count: n() })}` se aktualizuje se stavem.

**Změna jazyka:** texty už vykreslené zůstávají ve starém jazyce, proto se po změně postaví strom znovu. URL zůstane, rozepsané formuláře se ztratí.

```ts
translator.setLocale('en', locales.en);
void this.app.restart();
```

**Jiný překladač:** `Translator` je abstraktní třída s metodou `translate(key, params)`, obdoba `Nette\Localization\Translator`. Služba, která ji potřebuje, si o ni řekne v konstruktoru, a v kontejneru jde `IntlTranslator` nahradit jinou implementací.

## Volání serveru: RPC

Klient pro JSON-RPC 2.0, na druhé straně je [phloxcz/rpc-api](https://github.com/phloxcz/rpc-api). Importuje se z `phlox-js/net`.

### Typy z PHP

Server publikuje popis svých metod (dokument OpenRPC) na `/rpc/openrpc.json`. Ve výchozím stavu jen v debug režimu, viz `documentation.expose` v README `phlox-rpc-api`. Z něj se vygenerují typy:

```bash
npm run rpc:types -- http://localhost:9079/rpc/openrpc.json src/api/rpc.ts
npm run rpc:types -- api.json src/api/rpc.ts --class ShopApi    # ze souboru a s jiným názvem třídy
```

Vznikne soubor s rozhraními DTO, s popisem všech metod a s třídou `RpcApi`. Ručně se neupravuje, po změně API se vygeneruje znovu.

### Použití

```ts
// services.ts
import { RpcApi } from './api/rpc';

export const services = new Container();
services.add(new RpcApi('/rpc', {
  headers: () => {
    const token = services.get(User).token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
}));
```

```ts
class TasksPresenter extends Presenter {
  tasks = state<TaskResource[]>([]);

  constructor(private api: RpcApi) {
    super();
  }

  override async startup() {
    const page = await this.api.call('stats.tasks', { query: { pageSize: 20, sort: [{ field: 'dueDate' }] } });
    this.tasks.set(page.data);
  }
}
```

- **Kompilátor hlídá** název metody, parametry i typ výsledku. Překlep v `'stats.task'` nebo `sort: [{ field: 'title' }]` je chyba kompilace.
- **Parametry jsou pojmenované,** jako v PHP metodě. Když jsou všechny nepovinné, dají se vynechat: `this.api.call('stats.tasks')`.
- **Data a časy přijdou jako text,** JSON jiný typ nezná. U pole s formátem `date` nebo `date-time` to říká komentář ve vygenerovaném souboru.
- **Dávky jsou automatické:** volání ve stejném okamžiku, třeba přes `Promise.all`, odejdou na server jedním požadavkem. Vypíná se volbou `batch: false`.
- **`notify()`** zavolá metodu bez čekání na výsledek. Server neodpoví nic, ani chybu.
- **Session místo tokenu:** `new RpcApi('/rpc', { credentials: 'include' })`, prohlížeč pak posílá cookies i na jiný původ.
- **Bez typů** jde použít přímo `new RpcClient('/rpc')`, `call()` pak bere libovolnou metodu a vrací `any`.

### Chyby

Každé selhání je `RpcError` s `code`, `message`, `method` a `data`. Nepovedené volání v dávce neovlivní ostatní.

| `code` | Kdy |
|---|---|
| `401`, `403` | nepřihlášený uživatel, chybějící role |
| `-32602` | neplatné parametry, podrobnosti v `error.data.fields` |
| `-32601` | metoda neexistuje |
| kód z `ApiException` | chyba aplikace na serveru |
| HTTP stav | server odpověděl chybou HTTP |
| `0` | požadavek nedošel nebo nepřišla odpověď |

Konstanty jsou v `RpcErrorCode`. Odhlášení po vypršení tokenu jde vyřešit na jednom místě:

```ts
app.onError = error => {
  if (error instanceof RpcError && error.code === RpcErrorCode.Unauthorized) {
    app.user.logout();
    void app.router.navigate('/sign/in');
    return;
  }
  app.flashes.add(String(error), 'error');
};
```

## Uživatel a oprávnění

Jako `Nette\Security`: `User`, `Identity`, `Authenticator`, `Authorizator` a `Permission`. Importuje se z `phlox-js/security`.

**Oprávnění v prohlížeči jen řídí, co se zobrazí.** Skutečnou kontrolu musí udělat server (`#[Authorize]` v `phlox-rpc-api`), protože kód v prohlížeči si uživatel může změnit.

### Přihlášení

`Authenticator` ověří jméno a heslo, typicky voláním API, a vrátí `Identity`:

```ts
class ApiAuthenticator extends Authenticator {
  constructor(private api: RpcApi) {
    super();
  }

  async authenticate(username: string, password: string): Promise<Identity> {
    const result = await this.api.call('sign.in', { username, password });
    return new Identity(result.id, result.roles, { name: result.name }, result.token);
  }
}

services.add(ApiAuthenticator);
```

```ts
await this.user.login(username, password);   // Authenticator, při chybě vyhodí výjimku
await this.user.login(identity);             // přímo, třeba po registraci
this.user.logout();
```

- **`Identity(id, roles, data, token)`** odpovídá `SimpleIdentity`. Navíc má `token`, kterým se prohlížeč prokazuje serveru. Pro hlavičku `Authorization` je dostupný jako `this.user.token`.
- **Identita přežije obnovení stránky,** ukládá se do `sessionStorage`. Zavřením panelu se zapomene. Jiné úložiště: zaregistruj vlastní `UserStorage`, nebo `new BrowserUserStorage('klíč', () => localStorage)`.
- **`this.user`** je dostupný v každé komponentě a presenteru, jinde přes DI: `constructor(private user: User)`.

### Role a oprávnění

```ts
const acl = new Permission()
  .addRole('guest')
  .addRole('authenticated', 'guest')
  .addRole('admin', 'authenticated')
  .addResource('task')
  .allow('guest', 'task', 'view')
  .allow('authenticated', 'task', ['add', 'edit'])
  .allow('admin');                      // všechno

services.add(acl);
```

```ts
this.user.isLoggedIn()
this.user.isInRole('admin')
this.user.isAllowed('task', 'edit')
this.user.getIdentity()?.data.name
```

- **Role:** nepřihlášený má roli `guest`. Přihlášený bez rolí v identitě má `authenticated`. Názvy jdou změnit přes `user.guestRole` a `user.authenticatedRole`.
- **Pravidla jsou jako v Nette:** `null` znamená všechny role, zdroje nebo privilegia. Role a zdroje dědí od rodičů a konkrétnější pravidlo vyhrává. Když role dědí od více rodičů a jejich pravidla si odporují, platí to od rodiče uvedeného později. Bez pravidla je odpověď ne.
- **Podmínka u pravidla:** `allow('author', 'article', 'edit', () => article.authorId === user.getId())`.
- **Vlastní `Authorizator`:** stačí třída s metodou `isAllowed(role, resource, privilege)`, zaregistrovaná v kontejneru.

### V šabloně

Metody `User` čtou `state`, takže se šablona po přihlášení i odhlášení aktualizuje sama:

```tsx
<If when={() => this.user.isAllowed('task', 'delete')}>
  <button onClick={() => this.handleDelete()}>Smazat</button>
</If>
```

### Chráněný presenter

Jako v Nette se kontroluje ve `startup()`:

```ts
class AdminPresenter extends Presenter {
  override startup() {
    if (!this.user.isLoggedIn()) return this.redirect('/sign/in');
    if (!this.user.isInRole('admin')) this.error(403);
  }
}
```

Přesměrování ze `startup()` nebo akce zastaví celou navigaci, takže chráněná obrazovka se neobjeví ani na okamžik. V `startup()` použij absolutní cestu: presenter v tu chvíli ještě neví, na jaké části URL sedí.

Po přihlášení nebo odhlášení přesměruj (`this.redirect(...)`) nebo zavolej `this.app.restart()`, aby se obrazovky postavily znovu pro nového uživatele.

## Formuláře

Jako `Nette\Forms`. Importuje se z `phlox-js/forms`.

```tsx
// CreateTask je DTO vygenerované z PHP (npm run rpc:types)
class TaskCreatePresenter extends Presenter {
  form = new Form<CreateTask>();

  constructor(private api: RpcApi) {
    super();
    this.form.addText('name', 'Název:')
      .setRequired('Vyplňte název.')
      .addRule(Form.MaxLength, 'Nejvýš %d znaků.', 100);
    this.form.addSelect('priority', 'Priorita:', { 1: 'Nízká', 2: 'Střední', 3: 'Vysoká' })
      .setPrompt('Vyberte');
    this.form.addDate('dueDate', 'Termín:');
    this.form.addSubmit('save', 'Uložit');
    this.form.onSuccess = values => this.handleSave(values);
  }

  async handleSave(values: CreateTask) {
    await this.api.call('task.create', { input: values });
    this.flashMessage('Uloženo.');
    this.redirect('default');
  }

  render() {
    return <FormView form={this.form} />;
  }
}
```

- **Typ hodnot je DTO.** Kompilátor hlídá názvy prvků i jejich druh: `addText('nmae')` je chyba, stejně jako `addText('priority')`, když je priorita číslo. `onSuccess` dostane hodnoty typu `CreateTask`.
- **Formulář se tvoří v konstruktoru** nebo jako pole třídy, obdoba `createComponentXxx()`.
- **Data ze serveru** se do prvků dostanou přes `form.setDefaults({ name: task.name })`, typicky ve `startup()`.

### Prvky

| Metoda | Hodnota |
|---|---|
| `addText(name, label, maxLength?)` | text, `''` když je prázdný. S `setNullable()` je prázdný `null` |
| `addPassword`, `addEmail`, `addTextArea` | text. `addEmail` rovnou kontroluje formát |
| `addInteger`, `addFloat` | číslo nebo `null`. `addFloat` bere i desetinnou čárku |
| `addDate` | text `RRRR-MM-DD` nebo `null`, tak jak datum čeká DTO |
| `addCheckbox(name, caption)` | `true` / `false` |
| `addSelect`, `addRadioList` | jedna z hodnot položek nebo `null` |
| `addMultiSelect`, `addCheckboxList` | pole hodnot položek |
| `addDropDownList(name, label, options)` | jedna z hodnot položek nebo `null`, výběr s hledáním (viz DropDownList) |
| `addComboBox(name, label, options)` | jedna z hodnot položek nebo `null`, textové pole s návrhy (viz ComboBox) |
| `addTagInput(name, label, options)` | pole hodnot, štítky (viz TagInput) |
| `addHidden(name, value)` | text |
| `addSubmit(name, caption)` | tlačítko, mezi hodnotami není |
| `addContainer(name, label)` | vnořený objekt, viz Kontejnery a řádky |
| `addMultiplier(name, factory, options)` | seznam objektů, řádky, které uživatel přidává a řadí |

**Položky** výběrů se zadávají jako dvojice `[[1, 'Nízká'], [2, 'Vysoká']]`, nebo jako objekt `{ 1: 'Nízká' }`, ve kterém se celočíselné klíče převedou na čísla jako v PHP. Přijít mohou i později, třeba ze serveru: `control.setItems(...)`.

Další metody prvku: `setDisabled()` (nekontroluje se a chybí v hodnotách), `setOmitted()`, `getValue()`, `setValue()`, `errors()`, `addError()`.

### Pravidla a podmínky

```ts
form.addText('name').setRequired('Vyplňte jméno.');
form.addText('zip').addRule(Form.Pattern, 'PSČ má pět číslic.', '\\d{5}');
form.addInteger('age').addRule(Form.Range, 'Věk mezi %d a %d.', [18, 120]);

const password = form.addPassword('password').addRule(Form.MinLength, 'Aspoň %d znaků.', 8);
form.addPassword('again').addRule(Form.Equal, 'Hesla se neshodují.', password);

form.addText('note')
  .addConditionOn(form.get('done'), Form.Filled)
    .setRequired('U hotového úkolu vyplňte poznámku.')
  .elseCondition()
    .addRule(Form.MaxLength, 'Nejvýš %d znaků.', 50)
  .endCondition();
```

- **Pravidla:** `Filled` (= `Required`), `Blank`, `Equal`, `NotEqual`, `MinLength`, `MaxLength`, `Length`, `Email`, `URL`, `Pattern`, `Integer`, `Float`, `Min`, `Max`, `Range`, `IsIn`. `Min` a `Max` porovnávají i data: `addRule(Form.Min, 'Termín nesmí být v minulosti.', today)`.
- **Vlastní pravidlo** je funkce `(control, arg) => boolean`: `addRule(control => control.getValue() !== 'admin', 'Toto jméno je vyhrazené.')`.
- **Jako v Nette se pravidla kontrolují jen u vyplněného prvku,** kromě `setRequired`. Prázdné nepovinné pole s `Form.Email` je tedy v pořádku.
- **U prvku se hlásí jen první chyba.**
- **Zástupné hodnoty v hláškách:** `%d` a `%s` podle argumentů, `%label`, `%name`, `%value`.
- **Výchozí hlášky** jsou anglicky. Pro jazyk aplikace je přepiš jednou při startu: `Form.messages.set(Form.Filled, 'Vyplňte %label.')`.
- **`toggle(id)`** v podmínce zobrazí prvek s tím id, jen když podmínka platí: `form.get('done').addCondition(Form.Filled).toggle('note-pair')`.

### Kdy se kontroluje

- **Při odeslání** se zkontroluje celý formulář. Když neprojde, zavolá se `onError`, u polí se objeví chyby a kurzor skočí na první chybné pole. Při úspěchu se zavolá `onSuccess`.
- **Během psaní:** po opuštění pole se kontroluje živě. Chyba zmizí, jakmile ji uživatel opraví.
- **Přechod z pole na tlačítko** chybu ještě neukáže. Chyba by tlačítko posunula a klik by skončil vedle. Odeslání stejně zkontroluje celý formulář.
- **Během `onSuccess`** jsou tlačítka formuláře zakázaná a `form.submitting()` vrací `true`.
- **Tlačítko bez kontroly**, třeba Zrušit: `addSubmit('cancel').setValidationScope([])`. Které tlačítko formulář odeslalo, řekne v `onSuccess` metoda `button.isSubmittedBy()`.
- **Odeslání z kódu:** `await form.submit()`, třeba z tlačítka v patičce dialogu, které leží mimo `<form>`. Vrací, jestli formulář prošel.
- **Enter v textovém poli** formulář odešle, i když formulář nemá tlačítko pro odeslání a má víc textových polí. Prohlížeč by to sám neudělal.

### Chyby ze serveru

Kontrola v prohlížeči slouží uživateli, bezpečnost zajišťuje server. Když `onSuccess` skončí chybou neplatných parametrů z `phlox-rpc-api` (`-32602`), formulář ji nevyhodí, ale ukáže u polí. `input.name` patří k prvku `name`, `input.customer.city` k městu v kontejneru `customer` a `input.lines.2.quantity` k množství ve třetím řádku (viz Kontejnery a řádky). Cesta ke celým řádkům (`input.lines`) se ukáže nad řádky. Cesta, ke které prvek není, se ukáže jako chyba celého formuláře v `<FormErrors>`.

Ručně: `form.addServerErrors(error)` a vlastní předpona cesty `form.addServerErrors(error, 'data')`. Jiné chyby z `onSuccess` dostane `app.onError`.

**Žádné pravidlo nesmí platit jen v prohlížeči.** Co prohlížeč pustí a server odmítne, se uživateli ukáže u pole. Rozdílná pravidla jsou pak jen nepohodlí, ne díra.

### Vykreslení

**Automaticky** jako `{control form}`: `<FormView form={this.form} />`. Každý prvek dostane řádek s id `<id prvku>-pair` (pro `toggle()`) a nahoře jsou chyby formuláře.

**Ručně** jako `{form}…{/form}` v Latte:

```tsx
const name = this.form.get('name');

<FormTag form={this.form}>
  <div class="field">
    <Label control={name} />
    <Input control={name} class="wide" placeholder="např. Nákup" />
    <InputError control={name} />
  </div>
  <Input control={this.form.getButton('save')} class="btn btn-primary" />
</FormTag>
```

| Latte | PhloxJS |
|---|---|
| `{form}…{/form}` | `<FormTag form={…}>` |
| `{label name /}` | `<Label control={…} />`, povinný prvek má třídu `required` |
| `{input name}` | `<Input control={…} />`, další atributy dostane prvek |
| `{inputError name}` | `<InputError control={…} />` |
| `n:name="name"` | `<input class="x" {...control.attrs()} />` |
| chyby formuláře | `<FormErrors form={…} />` |

- **Přístupnost:** chybné pole má `aria-invalid` a `aria-describedby` vede na text chyby.
- **Checkbox** se vykresluje uvnitř svého `<label>`, jako v Nette.
- **Třídy dává téma** (viz Vzhled a témata). Třída předaná do `<Input>` se přidá k třídě tématu, u tlačítka ji nahradí: `<Input control={cancel} class="btn btn-secondary" />`.

### DropDownList

Výběr s vyhledávacím polem, převzatý z [phloxcz/forms-dropdownlist](https://github.com/phloxcz/forms-dropdownlist). Má stejné HTML, třídy a ovládání, takže vypadá stejně jako jeho serverová verze v Nette.

```ts
// Pevné položky, hledá se v prohlížeči
form.addDropDownList('category', 'Kategorie:', { items: categories, placeholder: 'Vyberte' });

// Položky ze serveru
form.addDropDownList('assignee', 'Řešitel:', {
  search: text => this.api.call('user.search', { text }),   // vrátí [[id, jméno], ...]
  label: id => this.api.call('user.name', { id }),          // popisek uložené hodnoty
}).setRequired('Vyberte řešitele.');
```

- **`items`** jsou pevné položky ve stejném tvaru jako u `addSelect`, filtrují se v prohlížeči.
- **`search`** se zavolá s `''` při otevření a pak s textem z vyhledávacího pole, 250 ms po posledním stisku. Starší odpověď nikdy nepřepíše novější.
- **`label`** zjistí popisek hodnoty nastavené z kódu (`setDefaults`), když hodnota není mezi položkami. V Nette ho dodává server při vykreslení.
- **Hledání nerozlišuje velikost písmen ani diakritiku:** „nap“ najde „Nápoje“ a zvýrazní „Náp“. Pro vlastní hledání na serveru je k dispozici `foldText()`.
- **Klávesnice:** šipka dolů seznam otevře, šipky vybírají, Enter a Tab potvrdí, Escape zavře jen seznam, ne dialog kolem něj. Klik mimo seznam ho zavře.
- **Kontrola** proběhne, až fokus opustí celý prvek, ne už při otevření seznamu.
- **Texty** jsou anglicky, přelož je jednou při startu: `DropDownList.texts.noResults = t('...')`, `DropDownList.texts.filterPlaceholder`.
- **Panel se otevře pod tlačítkem, nebo nad ním,** když se dolů celý seznam nevejde a nahoře je víc místa. Když se nevejde nikam, seznam se zkrátí. Je umístěný `fixed`, takže ho dialog ani posuvný kontejner neořízne. Stranu ukazuje atribut `data-placement` (`bottom`, `top`).
- **Vzhled** dodává téma: místa `dropdownlist.wrapper`, `dropdownlist.trigger`, `dropdownlist.dropdown`, `dropdownlist.item`... CSS je v `base.css` a `default.css`.

### ComboBox

Textové pole s návrhy, převzaté z [phloxcz/forms-combobox](https://github.com/phloxcz/forms-combobox). Na rozdíl od dropdownlistu se píše přímo do pole.

```ts
form.addComboBox('country', 'Země:', { search: text => this.api.call('country.search', { text }) });

// Napsaný text, který není mezi návrhy, se stane hodnotou
form.addComboBox('shop', 'Obchod:', { items: shops.map(shop => [shop, shop]), allowCustom: true });
```

- **Hodnota je vybraná položka.** Dokud uživatel jen píše, hodnota je `null`. Napsaný text, který není položkou, se po opuštění pole zahodí a vrátí se předchozí hodnota. Napsaný přesný název položky (bez ohledu na velikost písmen a diakritiku) se vybere sám.
- **`allowCustom: true`:** napsaný text se stane hodnotou a `isCustom()` vrací `true`. Kompilátor ho dovolí jen u pole, které může obsahovat text.
- **Klávesnice:** šipky vybírají, Enter vybere zvýrazněnou položku. Bez zvýraznění Enter odešle formulář jako v každém textovém poli. Escape v otevřeném seznamu vrátí předchozí hodnotu, v zavřeném ho dostane dialog kolem.
- **`items`, `search`, `label` a `placeholder`** fungují stejně jako u dropdownlistu, stejně se panel otáčí nahoru a hledá bez ohledu na diakritiku.
- **Texty:** `ComboBox.texts.noResults`. **Vzhled:** místa `combobox.wrapper`, `combobox.input`, `combobox.dropdown`, `combobox.item`...

### TagInput

Více hodnot jako štítky, převzaté z [phloxcz/forms-taginput](https://github.com/phloxcz/forms-taginput). Pole v DTO musí být seznam.

```ts
// Kategorie podle ID, jen z návrhů
form.addTagInput('categories', 'Kategorie:', { search: text => this.api.call('category.search', { text }) });

// Textové štítky, nové vznikají z napsaného textu
form.addTagInput('labels', 'Štítky:', { items: labels.map(label => [label, label]), allowNew: true, maxTags: 5 });
```

- **Návrhy se ukážou při psaní,** bez štítků, které už jsou přidané. S `allowNew` je posledním návrhem „Vytvořit: "text"“.
- **Přidání štítku:** Enter nebo čárka vezme zvýrazněný nebo první návrh. Když se návrhy neukazují, vezme napsaný text: přesný název položky, nebo s `allowNew` nový štítek. Enter v tomto poli nikdy neodešle formulář, jako v PHP verzi.
- **Odebrání:** křížek u štítku, nebo Backspace v prázdném poli odebere poslední.
- **Duplicity** se nepřidají, u textu bez ohledu na velikost písmen a diakritiku.
- **`maxTags`** omezí počet štítků. Pro chybovou hlášku použij pravidla `Form.MinLength` a `Form.MaxLength`, které u seznamu počítají štítky.
- **Napsaný text, který nebyl potvrzený,** se na štítek převede až při odeslání formuláře, ne při opuštění pole.
- **`getSplitValue()`** vrátí `{ picked, created }`: hodnoty vybrané z návrhů a texty nových štítků zvlášť, jako `getSplitValue()` v PHP.
- **`allowNew`** kompilátor dovolí jen u seznamu, který může obsahovat text. Výchozí je vypnuté (v PHP zapnuté).
- **Hodnoty z kódu:** `setValue([1, 2])`, popisky z položek nebo z `label`. Popisky ze serveru jdou předat rovnou: `setValue(ids, names)`.
- **Texty:** `TagInput.texts.createNew`, `TagInput.texts.remove`. **Vzhled:** místa `taginput.container`, `taginput.tag`, `taginput.tagNew`, `taginput.option`...

### Lokální a vzdálená data

Dropdownlist, combobox i taginput berou data dvěma způsoby:

| | `items` | `search` |
|---|---|---|
| **K čemu** | pevný seznam, filtruje se v prohlížeči | data ze serveru, filtruje server |
| **Dropdownlist, combobox: otevření bez psaní** | ukáže celý seznam | zavolá `search('')`, server vrátí první záznamy (třeba 100) |
| **Dropdownlist, combobox: při psaní** | filtruje hned | `search(text)` 250 ms po posledním stisku, starší odpověď se zahodí |
| **Taginput** | návrhy až při psaní | `search(text)` až při psaní, s prázdným textem se nevolá |

Volání s prázdným textem je záměrné, odpovídá `fetchData('')` v PHP knihovnách. Taginput ani v PHP nic nenabízí, dokud uživatel nepíše.

**`search` vrací stejný tvar jako `items`:** dvojice `[hodnota, popisek]`, nebo objekt `{ id: popisek }`. Když API vrací objekty, převedou se v té funkci. Třeba s metodou `stats.tasks` z `phlox-api-sample`:

```ts
form.addDropDownList('taskId', 'Úkol:', {
  search: async text => {
    const page = await this.api.call('stats.tasks', { query: { search: text, pageSize: 100 } });
    return page.data.map(task => [task.id!, task.name ?? ''] as const);
  },
  label: async id => (await this.api.call('task.read', { id })).name,   // pro uloženou hodnotu
});
```

- **Hledání bez ohledu na diakritiku** platí jen pro `items`. U `search` záleží na serveru. Pro vlastní filtrování v JS je `foldText()` z `phlox-js/forms`.
- **`label` je potřeba jen u `search`,** pro hodnotu nastavenou z kódu, která mezi načtenými záznamy není. U `items` se popisek najde v seznamu.
- **Obojí najednou:** seznam bere `search`, `items` slouží jen k hledání popisků.

### Předvybraná hodnota ze vzdálených dat

Když `search` vrací jen prvních pár záznamů (třeba 100) a uložená hodnota mezi nimi není, platí pro dropdownlist i combobox:

- **Popisek se dá předat s hodnotou,** pokud ho data ze serveru už obsahují. Pak není potřeba žádný dotaz: `form.get('assignee').setValue(task.assignee.id, task.assignee.name)`.
- **Jinak ho zjistí `label`** podle ID, i po `setDefaults({ assignee: 5372 })`.
- **Po otevření seznamu je uložená hodnota první,** i když mezi prvními záznamy není. Uživatel tak vidí, co je vybrané. Jakmile začne psát, zobrazí se jen to, co hledání vrátí.

### Kontejnery a řádky

DTO s vnořeným objektem a se seznamem objektů, třeba faktura s odběratelem a řádky:

```tsx
interface Line { name: string; quantity: number | null; price: number | null }
interface Invoice { number: string; customer: { name: string; city: string }; lines: Line[] }

form = new Form<Invoice>();
lines: Multiplier<Line>;

constructor() {
  super();
  this.form.addText('number', 'Číslo:');

  // Vnořený objekt, jako $form->addContainer() v Nette
  const customer = this.form.addContainer('customer', 'Odběratel');
  customer.addText('name', 'Název:').setRequired();
  customer.addText('city', 'Město:');

  // Řádky, které uživatel přidává, odebírá a řadí. Funkce přidá prvky jednoho řádku.
  this.lines = this.form.addMultiplier('lines', line => {
    line.addText('name', 'Položka').setRequired();
    line.addInteger('quantity', 'Množství').addRule(Form.Min, 'Aspoň %d.', 1);
    line.addFloat('price', 'Cena');
  }, { min: 1, max: 50, label: 'Řádky' });
}

// Součet sleduje psaní v každém řádku i přidání, odebrání a přesun
total = computed(() => this.lines.getValues().reduce((sum, line) => sum + (line.quantity ?? 0) * (line.price ?? 0), 0));
```

- **Typy:** kontejner nabízí jen prvky vnořeného objektu, řádek jen prvky položky seznamu. `addContainer` jde jen na objekt, `addMultiplier` jen na seznam objektů. Seznam textů nebo čísel je `addTagInput` nebo `addCheckboxList`.
- **Hodnoty** mají tvar DTO: `{ number, customer: { name, city }, lines: [{ name, quantity, price }, ...] }`, řádky v pořadí, v jakém je uživatel seřadil. `setDefaults` bere i neúplné vnořené objekty a řádky. Řádků vznikne tolik, kolik jich přijde, nejméně `min`.
- **Přístup:** `form.getContainer('customer').get('city')`, `form.getMultiplier('lines')`, `lines.rows()` (řádky jako kontejnery, reaktivně), `row.get('name')`.
- **Řádky z kódu:** `lines.add({ name: 'Doprava' })` (vrátí `null`, když je jich už `max`), `lines.add(values, 0)` na začátek, `lines.remove(row)` (ne pod `min`), `lines.move(row, 2)`, `lines.canAdd()`, `lines.canRemove()`.
- **`min` a `max`:** tlačítka je hlídají, a když se počet nesejde (třeba po `setValues`), ukáže se nad řádky chyba `Multiplier.texts.min` nebo `max`. Bez `max` není horní hranice.
- **Kontrola** prochází všechny kontejnery i řádky, kurzor skočí na první chybu.
- **Atributy `name`** jsou jako v Nette: `customer[city]`, `lines[3][quantity]`. Číslo v `name` a `id` řádku se při přesunu nemění, takže id zůstávají jedinečná. Pořadí dává jen pořadí řádků.

**Vykreslení:** `<FormView>` ukáže kontejner jako `<fieldset>` s legendou a řádky s ovládáním:

- **úchyt ⠿** pro přetažení myší, perem i prstem; na úchytu posouvají řádek i šipky nahoru a dolů z klávesnice,
- **tlačítka ↑ ↓ ×** pro posun a odebrání,
- **„+ Add“** přidá řádek a kurzor dá do jeho prvního pole.

Ručně, třeba jako tabulku bez popisků v každém řádku:

```tsx
<FormTag form={this.form}>
  <MultiplierView multiplier={this.lines}>
    {(line, index) => (
      <>
        <span>{() => index() + 1}.</span>
        <Input control={line.get('name')} /> <InputError control={line.get('name')} />
        <Input control={line.get('quantity')} />
      </>
    )}
  </MultiplierView>
  <p>Celkem: {() => this.total()}</p>
</FormTag>
```

- **`<MultiplierView>`** dává úchyt, tlačítka a přidání. Funkce v něm vykreslí prvky řádku, `index()` je jeho reaktivní pořadí.
- **`<MultiplierErrors multiplier={…} />`** ukáže chyby počtu řádků, když `<MultiplierView>` nepoužiješ.
- **Řádky jsou `<For>` bez `key`:** při přesunu se prvek přesune s celým obsahem, rozepsaný text ani fokus se neztratí.
- **Texty** jsou anglicky, přelož je jednou při startu: `Multiplier.texts.add`, `remove`, `moveUp`, `moveDown`, `drag`, `min`, `max`.
- **Vzhled** dodává téma: místa `group`, `legend`, `multiplier`, `multiplierRow`, `multiplierHandle`, `multiplierFields`, `multiplierField`, `multiplierButtons`, `multiplierButton`, `multiplierAdd`. Tažený řádek má třídu `phlox-dragging`.

Ukázka je v `examples/shopping-list` na stránce Recept.

### Řazení tažením jinde

Tažení řádků stojí na funkci `dragToSort` z `phlox-js`, kterou jde použít pro jakýkoli seznam:

```tsx
render() {
  let list: HTMLElement;
  return (
    <ul ref={el => { list = el; }}>
      <For each={this.cards}>
        {card => {
          let element: HTMLElement;
          return (
            <li ref={el => { element = el; }}>
              <span class="handle" onPointerdown={event => dragToSort(event, element, {
                items: () => [...list.children] as HTMLElement[],
                move: to => this.cards.update(cards => {
                  const rest = cards.filter(other => other !== card);
                  rest.splice(to, 0, card);
                  return rest;
                }),
                done: () => this.handleSaveOrder(),
              })}>⠿</span>
              {card.name}
            </li>
          );
        }}
      </For>
    </ul>
  );
}
```

- **`items`** vrací prvky všech položek v aktuálním pořadí, i taženou.
- **`move(to)`** přesune taženou položku v datech. `<For>` pak přesune prvek, takže uživatel vidí nové pořadí hned během tažení.
- **`done`** se zavolá po puštění, třeba pro uložení pořadí na serveru.
- **Tažená položka jede volně za ukazatelem** (posun přes `transform`), ostatní jí plynule uhýbají a po puštění položka dosedne na místo. Během tažení má třídu `phlox-dragging`.
- **`layout`** říká, jak položky leží, a podle toho se volí pořadí: `'vertical'` (výchozí, pod sebou, podle svislé polohy), `'horizontal'` (vedle sebe, podle vodorovné) a `'grid'` (v řádcích, které se zalamují, v pořadí čtení: řádek po řádku, zleva doprava). Položky mřížky by měly mít stejnou výšku.
- **`lockAxis: true`** nechá položku jezdit jen po ose seznamu, u `'vertical'` jen nahoru a dolů. U mřížky nemá smysl.
- **Pozice** se volí podle středu tažené položky proti středům ostatních.
- **Úchyt může být celá položka:** `onPointerdown` dej přímo na ni.
- **U okraje se posouvá:** když ukazatel dojede k okraji, posouvá se nejbližší posuvný prvek kolem seznamu (třeba dialog nebo box s `overflow: auto`), jinak stránka. Čím blíž okraji, tím rychleji. Funguje svisle i vodorovně a zastaví se na konci obsahu.
- **Úchyt potřebuje CSS `touch-action: none`,** jinak prstem posouvá stránku.

### Vlastní prvek

Prvek je potomek `FormControl<T>` s metodami `getValue()`, `setValue()`, `isFilled()` a `render(attributes)`. Do formuláře se přidá přes `form.addControl('name', new MyControl('Popisek:'))`. Pravidla, `<Label>`, `<Input>`, chyby ze serveru i hodnoty pak fungují jako u vestavěných prvků. Tak vzniknou i combobox, dropdownlist a taginput.

## Reaktivní hodnoty

### `state`

Hodnota, která se může měnit. Čte se zavoláním, mění přes `set` nebo `update`.

```ts
const count = state(1);

count();                    // 1
count.set(2);
count.update(n => n + 1);   // 3
```

Nastavení stejné hodnoty nic nespustí. Pole a objekty se porovnávají identitou, takže se nemění na místě, ale nahrazují:

```ts
items.update(list => [...list, item]);   // správně
items().push(item);                      // špatně, nikdo se o změně nedozví
```

### `computed`

Odvozená hodnota. Spočítá se, až ji někdo čte, a znovu jen tehdy, když se změnilo něco, co četla.

```ts
const remaining = computed(() => items().filter(item => !item.done()).length);
```

`computed` nesmí měnit žádný `state`, skončí to chybou.

### `effect`

Funkce, která se spustí hned a pak znovu po každé změně toho, co četla. V šablonách není potřeba, ty se aktualizují samy. Hodí se pro napojení na okolí: titulek stránky, `localStorage`, cizí widget.

```ts
const stop = effect(() => {
  document.title = `Zbývá ${remaining()}`;
});

stop();   // ukončí efekt
```

Efekt může vrátit úklidovou funkci. Zavolá se před dalším spuštěním a při ukončení:

```ts
effect(() => {
  const timer = setInterval(tick, delay());
  return () => clearInterval(timer);
});
```

### `batch` a `untrack`

```ts
// Více změn najednou, efekty a šablony se aktualizují až po poslední
batch(() => {
  first.set('Jan');
  last.set('Novák');
});

// Přečte hodnotu, aniž by se na ni efekt přihlásil
effect(() => {
  save(form(), untrack(userId));
});
```

## Šablony

Šablony se píšou v TSX. Kvůli samotnému TSX se nic neimportuje, ani pro `<>…</>`. Projekt to má nastavené jednou v `tsconfig.json`:

```json
"jsx": "react-jsx",
"jsxImportSource": "phlox-js"
```

Název balíčku `phlox-js` je předběžný. Uvnitř tohoto repa ho na `src/` převádí `paths` v `tsconfig.json`.

Šablonu vrací `render()` komponenty nebo presenteru. Kousek šablony jde vyčlenit do funkce:

```tsx
function Counter() {
  const count = state(0);
  return <button onClick={() => count.update(n => n + 1)}>Kliknuto: {count}</button>;
}
```

Bez aplikace a presenterů jde šablonu vložit do stránky funkcí `render`, která vrátí funkci pro odstranění: `const remove = render(() => <Counter />, element)`. Komponenty psané jako třída takto použít nejdou, potřebují běžící `Application`.

### Co je reaktivní

**Reaktivní je to, co předáš jako `state` nebo funkci.** Obyčejná hodnota se přečte jednou při vytvoření.

```tsx
<span>{count}</span>                        // aktualizuje se
<span>{() => count() * 2}</span>            // aktualizuje se
<span>{count() * 2}</span>                  // přečte se jednou, dál se nemění

<li class={() => (done() ? 'done' : '')} /> // aktualizuje se
<input disabled={saving} />                 // aktualizuje se
```

Komponenta (funkce jako `Counter` výše) se spustí jednou. Nespouští se znovu při změně stavu, mění se jen místa v šabloně, která stav čtou.

### Atributy

- **Názvy** jsou jako v HTML: `class`, `for`. Kompilátor hlídá názvy i typy podle prvku.
- **`false`, `null` a `undefined`** atribut odstraní: `disabled={false}` prvek nezakáže.
- **`value` a `checked`** se nastavují tak, jak je uživatel vidí, i poté, co do pole psal.
- **`style`** bere text nebo objekt: `style={{ color: 'red' }}`.
- **Text se nikdy nevkládá jako HTML.** `innerHTML` mezi atributy záměrně není.
- **SVG** zatím není podporované.

### Události

Události jsou `on` + název s velkým písmenem. `event.currentTarget` má typ podle prvku.

```tsx
<input value={draft} onInput={event => draft.set(event.currentTarget.value)} />
<form onSubmit={save} />
```

### Přístup k prvku: `ref`

`<div />` v kódu není DOM prvek, je to šablona. Skutečný prvek vznikne až při vložení do stránky a dostaneš ho přes `ref`:

```tsx
<input ref={element => element.focus()} />
```

Díky tomu jde šablonu uložit do proměnné, předat jinam nebo vložit vícekrát. Pokaždé vznikne nová instance.

## Podmínky: `<If>`

Píše se jako `{if} … {elseif} … {else} … {/if}` v Latte. `<ElseIf />` a `<Else />` oddělují větve.

```tsx
<If when={user}>
  <Profile />
<ElseIf when={loading} />
  <Spinner />
<Else />
  <Login />
</If>
```

- **Existuje jen zobrazená větev.** Zobrazí se první větev se splněnou podmínkou. Ostatní se nevytvoří vůbec, jejich komponenty neběží. Skrytá větev se z DOM odstraní a uklidí, při dalším zobrazení vznikne nová.
- **Podmínka je `state` nebo funkce:** `when={user}`, `when={() => items().length > 0}`. Zápis `when={items().length > 0}` kompilátor odmítne, protože by se vyhodnotil jen jednou.
- **Větev se nepřestavuje zbytečně.** Když se hodnota podmínky změní, ale větev zůstává stejná, DOM zůstane.

**Hodnota podmínky uvnitř větve:** TypeScript neví, že `user()` uvnitř není `null`. Buď napíšeš `user()!.name`, nebo si v první větvi necháš hodnotu předat jako parametr:

```tsx
<If when={user}>
  {u => <b>{() => u().name}</b>}
</If>
```

## Seznamy: `<For>`

Uvnitř je funkce, která pro položku vrátí šablonu řádku. Při změně seznamu zůstanou v DOM řádky, které v něm byly, a jen se doplní, odeberou nebo přesunou. Má dva režimy.

### Bez `key`: položky jsou objekty, které žijí dál

Řádek patří konkrétnímu objektu. Položku dostaneš jako obyčejnou hodnotu. Co se má v řádku měnit, je `state` uvnitř položky.

```tsx
interface Item {
  name: string;
  done: State<boolean>;
}

const items = state<Item[]>([]);

<For each={items}>
  {item => (
    <li class={() => (item.done() ? 'done' : '')}>
      <input
        type="checkbox"
        checked={item.done}
        onChange={event => item.done.set(event.currentTarget.checked)}
      />
      <span>{item.name}</span>
      <button onClick={() => remove(item)}>Smazat</button>
    </li>
  )}
</For>
```

### S `key`: seznam se načítá znovu ze serveru

`key` říká, podle čeho se pozná „ten samý řádek“. Když přijdou úplně nové objekty, řádky se stejným klíčem zůstanou v DOM a jen se aktualizují. Zachová se tak fokus, pozice rolování i rozepsaný text.

```tsx
interface Item {
  id: number;
  name: string;
  done: boolean;
}

const items = state<Item[]>([]);

<For each={items} key={item => item.id}>
  {item => (
    <li class={() => (item().done ? 'done' : '')}>
      <input
        type="checkbox"
        checked={() => item().done}
        onChange={event => api.setDone(item().id, event.currentTarget.checked)}
      />
      <span>{() => item().name}</span>
      <button onClick={() => remove(item().id)}>Smazat</button>
    </li>
  )}
</For>
```

**Položka je tu funkce, ne hodnota.** Řádek přežije výměnu objektu, takže se musí umět zeptat na aktuální data: `item().name`.

**Pozor na jednu chybu:** co se má samo aktualizovat, musí být ve funkci. `{() => item().name}` se aktualizuje, `{item().name}` se přečte jen jednou při vytvoření řádku. Že je `item` funkce, hlídá kompilátor. To obalení do funkce už ne.

### Kdy který režim

| Situace | Režim |
|---|---|
| Položky vznikají v prohlížeči a mění se jejich vnitřní `state` | bez `key` |
| Seznam se načítá z RPC nebo se položky nahrazují novými objekty | s `key` |

Bez `key` by znovu načtený seznam fungoval taky, jen by se všechny řádky zahodily a postavily znovu.

### Pořadí řádku

Druhý parametr je pořadí řádku jako funkce. Aktualizuje se při přesunu.

```tsx
<For each={items}>
  {(item, index) => <li>{() => index() + 1}. {item.name}</li>}
</For>
```

## Úklid

Úklid je automatický. Když zmizí větev `<If>`, řádek `<For>` nebo celé view z `render`, zruší se všechny jejich efekty a posluchače událostí. V šabloně není potřeba nic odhlašovat.

Vlastní úklid (časovač, cizí widget) se přihlásí přes `onCleanup` nebo návratovou hodnotou efektu:

```tsx
function Clock() {
  const now = state(new Date());
  const timer = setInterval(() => now.set(new Date()), 1000);
  onCleanup(() => clearInterval(timer));
  return <time>{() => now().toLocaleTimeString()}</time>;
}
```
