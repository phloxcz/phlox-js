# PhloxJS: příručka

Jak se s frameworkem pracuje. Popisuje jen to, co je už napsané a otestované. Proč je co navržené tak, jak je, najdeš v [design.md](design.md).

**Co zatím chybí:** persistentní parametry a adaptér pro Kendo.

**Kde co je:** jádro (reaktivita, šablony, komponenty, presentery, aplikace, DI) se importuje z `phlox-js`. Volitelné části mají vlastní vstup: síť (RPC) `phlox-js/net`, přihlášení a oprávnění `phlox-js/security`, formuláře `phlox-js/forms`, překlady `phlox-js/localization` a Vite plugin `phlox-js/vite`.

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

Výchozí okno je nativní `<dialog class="phlox-dialog">` s částmi `header`, `.phlox-dialog-body` a `footer`. Framework mu žádný vzhled nedává, styly jsou na aplikaci (viz `index.html` v ukázce).

Okno dodává služba `Dialogs`. Jinou implementaci, třeba nad Kendo Window, zaregistruješ v kontejneru: `services.add(KendoDialogs)`.

## Flash zprávy

```ts
this.flashMessage('Uloženo.', 'success');   // v presenteru
```

Zprávy drží `app.flashes`. Kde a jak se zobrazí, určuje layout:

```tsx
<For each={this.app.flashes.messages}>
  {flash => <p class={`flash ${flash.type}`} onClick={() => this.app.flashes.remove(flash)}>{flash.text}</p>}
</For>
```

Samy nemizí. Odebírá je `remove()`.

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
| `addHidden(name, value)` | text |
| `addSubmit(name, caption)` | tlačítko, mezi hodnotami není |

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
- **Během `onSuccess`** jsou tlačítka formuláře zakázaná a `form.submitting()` vrací `true`.
- **Tlačítko bez kontroly**, třeba Zrušit: `addSubmit('cancel').setValidationScope([])`. Které tlačítko formulář odeslalo, řekne v `onSuccess` metoda `button.isSubmittedBy()`.
- **Odeslání z kódu:** `await form.submit()`, třeba z tlačítka v patičce dialogu, které leží mimo `<form>`. Vrací, jestli formulář prošel.

### Chyby ze serveru

Kontrola v prohlížeči slouží uživateli, bezpečnost zajišťuje server. Když `onSuccess` skončí chybou neplatných parametrů z `phlox-rpc-api` (`-32602`), formulář ji nevyhodí, ale ukáže u polí. `input.name` patří k prvku `name`. Cesta, ke které prvek není (třeba `input.addresses.1.city`), se ukáže jako chyba celého formuláře v `<FormErrors>`.

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
- **Vzhled je na aplikaci.** Framework dává třídy `phlox-form`, `phlox-form-row`, `phlox-form-error`, `phlox-form-errors` a `phlox-form-buttons`.

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
