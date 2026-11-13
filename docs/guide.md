# PhloxJS: příručka

Jak se s frameworkem pracuje. Popisuje jen to, co je už napsané a otestované. Proč je co navržené tak, jak je, najdeš v [design.md](design.md).

**Kde co je:** jádro (reaktivita, šablony, komponenty, presentery, aplikace, DI) se importuje z `phlox-js`. Volitelné části mají vlastní vstup: síť (RPC) `phlox-js/net`, přihlášení a oprávnění `phlox-js/security`, formuláře `phlox-js/forms`, překlady `phlox-js/localization`, pomocníci pro testy `phlox-js/testing` a Vite plugin `phlox-js/vite`. Napojení cizích knihoven (adaptéry) jsou pod `phlox-js/adapters/…`.

Všechno níže je vidět pohromadě v ukázce [examples/shopping-list](../examples/shopping-list/main.ts). Celou aplikaci proti serveru (přihlášení, RPC, vnořené presentery, `resource`, `Dropdown`) ukazuje [examples/helpdesk](../examples/helpdesk/main.ts).

## Spuštění

| Příkaz | Co dělá |
|---|---|
| `npm run dev` | spustí ukázky: rozcestník na `/`, každá ukázka pod svou cestou (`/shopping-list`, `/tree`, `/grid`, `/kendo`, `/helpdesk`), přepíná se lištou nahoře. Helpdesk má mock JSON-RPC server v dev serveru (`examples/helpdesk/server/`), účty jsou na přihlašovací stránce. Sestavené ukázky ho nemají |
| `npm run build:examples` | sestaví ukázky do `examples/dist` |
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
- **`app.basePath`** je cesta, pod kterou aplikace na webu běží, když není v kořeni: `app.basePath = '/admin'` před `run()`. Routy se počítají od ní, odkazy ji obsahují (`link('/about')` dá `/admin/about`) a odkaz mimo ni načte prohlížeč jako jinou stránku. Server musí na každou adresu pod ní vrátit stránku aplikace.
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
- **Odkazy:** `this.link('/projects/5')` nebo `this.link('detail', { id: 5 })` podle rout presenteru, ve kterém komponenta je. Ten je v `this.presenter`, jako `getPresenter()` v Nette.
- **`effect()` a `computed()` v inicializátoru pole, konstruktoru nebo `startup()`** patří komponentě a skončí s ní. Ve `startup()` jen ty vytvořené před prvním `await`, za ním už JS neví, čí kód běží.

### Zapamatovaná nastavení: `preference`

Nastavení uživatele, které si aplikace pamatuje (šířka sloupce, sbalené menu, zvolený pohled), je `state`, který se při každé změně uloží:

```ts
readonly collapsed = this.preference('nav.collapsed', false);

this.collapsed.update(value => !value);   // uloží se
```

- **Kde se ukládá,** rozhoduje služba `Preferences`. Výchozí `BrowserPreferences` píše do `localStorage` jako JSON pod `phlox.` + klíč. Jiné úložiště (server, `sessionStorage`) je vlastní třída s metodami `get(key)` a `set(key, value)`, zaregistrovaná v kontejneru: `services.add(new ServerPreferences())`. Jen jiná předpona: `services.add(new BrowserPreferences('crm.'))`.
- **Klíč** je společný celé aplikaci, dej mu předponu podle místa: `'tasks.width'`.
- **Zablokované úložiště** (anonymní okno) nevadí, nastavení se jen nezapamatuje.

### Šířka sloupce: `ResizeHandle`

Úchyt na okraji prvku, kterým uživatel mění jeho šířku. Šířka je `state`, s `preference` se tedy rovnou pamatuje:

```tsx
import { ResizeHandle } from 'phlox-js';

readonly width = this.preference('tasks.width', 416);

<section style={() => ({ width: `${this.width()}px` })}>
  …
  <ResizeHandle size={this.width} min={300} max={760} initial={416} label="Šířka seznamu úkolů" />
</section>
```

- **Patří jako poslední dítě** prvku, jehož šířku mění. `base.css` prvku nastaví `position: relative` a úchyt položí na jeho pravý okraj, s `edge="start"` na levý (prvek pak roste doleva).
- **Ovládání:** tažení myší nebo prstem, Escape během tažení vrátí původní šířku, dvojklik vrátí `initial`. S fokusem na úchytu mění šířku šipky (o 16 px, se Shiftem o 64) a Home a End nastaví `min` a `max`. Čtečky ho znají jako `separator` s hodnotou.
- **Prvek, který se posouvá** (`overflow: auto`), by úchyt posouval s obsahem. Posouvat má jeho vnitřek, ne on sám.
- **Šířku jde dát i do proměnné CSS** a nechat ji rozložení: `style={() => `--list-width: ${this.width()}px`}` a v CSS `flex: 0 1 var(--list-width)`. Na telefonu ji pak media query může přebít.

### Data, která se načítají znovu: `resource`

Seznam, který závisí na stavu (záložka, filtr, vybraný projekt), si řekne o data funkcí. Načte se znovu, kdykoli se změní stav přečtený v ní:

```tsx
import type { Resource } from 'phlox-js';

class TasksPresenter extends Presenter<{ projectId: number }> {
  readonly status = computed(() => this.params().status ?? null);
  tasks!: Resource<TaskPage>;

  override async startup() {
    this.tasks = this.resource(() => this.api.call('task.list', { projectId: this.props.projectId, status: this.status() }));
    await this.tasks.ready();   // obrazovka se ukáže až s daty
  }

  render() {
    return <For each={() => this.tasks()?.data ?? []} key={task => task.id}>{task => <li>{() => task().title}</li>}</For>;
  }
}
```

- **`tasks()`** je poslední načtená hodnota, `undefined` před prvním načtením. Během dalšího načítání zůstává, `tasks.loading()` je mezitím `true`.
- **Sleduje se stav přečtený před prvním `await`** ve funkci. V `async` funkci tedy čti stav na začátku.
- **Starší odpověď nepřepíše novější,** i když přijde později.
- **Chyba** jde do `app.onError`, hodnota zůstane poslední dobrá.
- **`tasks.reload()`** načte znovu se stejným stavem, `tasks.ready()` počká na běžící načtení.
- **Vytvoř ho v konstruktoru nebo ve `startup()`.** V inicializátoru pole ještě nejsou služby z konstruktoru. U presenteru, který čte své parametry, ve `startup()`, ten je už zná.
- **Skončí s komponentou,** po jejím odstranění se nic nenačítá.

### Data sdílená obrazovkami: štítky a `invalidate`

Po uložení se mají obnovit i jiné části obrazovky: seznam, počty v záložkách, číslo v menu. Zdroj proto řekne, jaká data ukazuje, a po změně stačí ta data zneplatnit:

```ts
// seznam úkolů
this.tasks = this.resource(() => this.api.call('task.list', { … }), { tags: ['tasks'] });

// detail po uložení: načte se znovu všechno se štítkem 'tasks', na kterékoli obrazovce
await this.api.call('task.update', { id, input });
this.app.invalidate('tasks');
```

- **Štítky** jsou libovolné texty, obvykle podle druhu dat: `'tasks'`, `'projects'`, `'users'`. Zdroj jich může mít víc.
- **`invalidate()`** jich přijme víc najednou: `this.app.invalidate('tasks', 'projects')`. Zdroje, které se tím spustí, se volají v jednom okamžiku, takže jdou na server jednou dávkou.
- **Data celé aplikace** (uživatelé, číselníky), která drží služba, ne komponenta: `app.resource(load, { tags })`. Žije, dokud aplikace běží. Služba si `Application` řekne v konstruktoru jako každou jinou službu.
- **Po přihlášení jiného uživatele** zneplatni data, která drží služby: `this.app.invalidate('users', 'projects', 'tasks')`.

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
- **`pattern`** je díl URL. Parametr se píše `<id>` (jeden díl cesty), `<id:int>` (celé číslo) nebo s regulárním výrazem `<id \d+>`. Ve výrazu se v řetězci lomítko zdvojuje (`'/<id \\d+>'`); vzor s jedním (`<id d+>`) skončí chybou s radou, ne routou, která tiše nesedí. Routy se zkoušejí v pořadí, první vyhovující vyhrává.
- **`presenter`** je presenter pro `<RouteFrame />`, buď třída, nebo funkce s `import()` (viz Líné načítání presenterů).
- **`props`** udělá z parametrů routy props jejího presenteru: `{ pattern: '/<id \\d+>', presenter: TasksPresenter, props: ({ id }) => ({ projectId: Number(id) }) }`. Presenter se při změně parametrů vytvoří znovu, takže props se za jeho života nemění. Jeden presenter tak může sloužit víc routám: `{ pattern: '/my', presenter: TasksPresenter, props: () => ({ mine: true }) }`.
- **Routa s `presenter` bere začátek URL,** routa bez něj musí sedět na celý zbytek.
- **`/`** znamená „nic dalšího“. Prázdný vzor `''` nebere nic a všechno předá dál, hodí se pro layout.
- **Presenter bez rout** je jedna stránka a jeho akce je `actionDefault()`.
- **`routes` potřebuje typ `Route[]`,** jinak TypeScript neodvodí typy parametrů ve funkcích uvnitř.

### Líné načítání presenterů

```ts
{ name: 'projects', pattern: '/projects', presenter: ProjectsPresenter },                 // v hlavním balíku
{ name: 'reports', pattern: '/reports', presenter: () => import('./ReportsPresenter') },  // až při první návštěvě
```

- **Třída** je v hlavním balíku JavaScriptu, který prohlížeč stáhne hned při startu.
- **Funkce s `import()`** z presenteru udělá samostatný soubor (Vite ho oddělí sám). Prohlížeč ho stáhne, až uživatel na routu poprvé přijde. Router na něj počká jako na jinou přípravu obrazovky a stará obrazovka mezitím zůstává.
- **Kdy co:** co je na první obrazovce nebo skoro všude, importuj přímo, jinak by start čekal na další požadavek. Co je stranou (nastavení, reporty, administrace), načítej líně. V aplikaci se stovkou obrazovek to rozhoduje o velikosti prvního načtení.
- **Líně načítaný soubor** musí presenter exportovat jako `default`: `export default class ReportsPresenter extends Presenter`. Typy hlídá kompilátor stejně.

### Typované routy: `route()`

```ts
import { route } from 'phlox-js';

class TasksPresenter extends Presenter {
  readonly detail = route('detail', '/<task:int>', { presenter: TaskDetailPresenter, props: ({ task }) => ({ taskId: task }) });

  override routes: Route[] = [{ name: 'default', pattern: '/' }, this.detail];

  render() {
    return <a href={this.link(this.detail, { task: 5 })}>Úkol 5</a>;   // task chybí nebo je text: chyba kompilace
  }
}
```

- **Typy parametrů** se čtou ze vzoru: `<task:int>` je v `props` a `dialog` číslo, `<slug>` text. `Number(…)` odpadá.
- **`link(this.detail, { task })`** a `redirect(this.detail, { task })` kompilátor hlídá: chybějící parametr i špatný typ je chyba. Další parametry jdou do query jako u `link('detail', …)`.
- **I za běhu:** `link()` s textem místo čísla u `:int` vyhodí chybu hned, ne až nefunkční odkaz.
- **`this.params()` a akce** dostávají parametry dál jako texty z URL, spolu s query. Převedené jsou jen v `props` a `dialog` routy.
- **Obyčejné routy** (`{ name, pattern }`) fungují dál, `<id:int>` v nich převede hodnotu pro `props` a `dialog` stejně, jen bez typové kontroly odkazů.

### Akce a parametry

- **Parametry jsou texty:** `actionDetail({ id })` dostane `'15'`, na číslo si ho převeď.
- **Query parametry** (`?page=2`) dostane presenter na konci řetězu, tedy ten, jehož routa nemá `presenter`. Parametr routy má při stejném názvu přednost. Své persistentní parametry (viz níže) dostane presenter i uprostřed řetězu.
- **Ve `startup()` presenter už zná** své `route()`, `params()` a `basePath()`, jako v Nette.
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

Odkaz je obyčejné `<a href>`. Kliknutí zachytí aplikace a přejde bez načtení stránky, otevření v novém panelu funguje normálně. Odkaz s `target` nebo `download`, odkaz na jiný web a odkaz mimo `app.basePath` nechá prohlížeči.

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

### Persistentní parametry

Jako `#[Persistent]` v Nette: query parametry, které si odkazy presenteru nesou dál.

```ts
class OrdersPresenter extends Presenter {
  override persistent = ['page', 'sort', 'filter.*'];
}

// na /orders?page=3&sort=-price&tab=x
this.link('detail', { id: 5 })               // /orders/5?page=3&sort=-price
this.link('detail', { id: 5, page: null })   // /orders/5?sort=-price
```

- **Platí pro odkazy presenteru a presenterů pod ním** na jejich routy. `link('this')` nese celé query vždy, absolutní cesta (`link('/about')`) nic.
- **Název s `*` na konci** platí pro všechny, které tak začínají: `'filter.*'`.
- **Parametr předaný `link()` má přednost,** `null` ho vynechá.
- **Hodnoty jsou texty** z URL, převádí je ten, kdo je čte (akce, grid).
- **Zavření routovaného dialogu** po přímém odkazu vede na URL presenteru i s jeho persistentními parametry, takže seznam pod dialogem zůstane, jak byl.

### Jak probíhá navigace

- **Stará obrazovka zůstává, dokud nová není připravená.** Nové presentery se vytvoří stranou, proběhne jejich `startup()` a akce, a teprve pak se obrazovka vymění.
- **Když cokoli selže, nezmění se nic** a chybu dostane `app.onError`.
- **Běží jen jedna navigace.** Když uživatel klikne jinam dřív, než doběhne, vyhrává poslední kliknutí.

### Titulek stránky a čtečky

```ts
class TaskDetailPresenter extends Presenter {
  override pageTitle() {
    return this.task()?.title ?? null;   // jako {block title} v Nette, může číst state
  }
}
```

- **`document.title`** dá nejhlubší presenter, který titulek má. Na `/projects/1/5` tedy úkol, ne seznam. Mění se se stavem, který `pageTitle()` čte.
- **Složení** dělá `app.formatTitle`: ve výchozím stavu „Úkol – <titulek z index.html>“, bez titulku stránky jen titulek z `index.html`. Jinak: `app.formatTitle = page => page ? `${page} | Obchod` : 'Obchod'`.
- **Čtečky** se po přechodu na jinou stránku dozví její titulek (skrytá oblast `aria-live`). Změna jen query (záložka, filtr) se neohlašuje.
- **Fokus** po navigaci zůstává, kde byl, aby seznam s detailem neztratil místo. Když ale prvek s fokusem zmizel se starou stránkou, přejde fokus na první `<h1>` nové stránky.

### Odchod s neuloženými změnami

Komponenta, která drží rozpracované změny, to řekne metodou `hasUnsavedChanges()`. Typicky podle formuláře:

```ts
class ItemEdit extends Presenter {
  override hasUnsavedChanges() {
    return this.form.isChanged();
  }
}
```

Než taková komponenta odejde, framework se uživatele zeptá „Odejít bez uložení změn?“ s tlačítky Zrušit a Odejít:

- **Jiný odkaz, `redirect`, `navigate`:** nová obrazovka se připraví stranou a před výměnou přijde otázka. Při Zrušit zůstane stará obrazovka i URL.
- **Tlačítko Zpět a Vpřed:** prohlížeč změní URL dřív, než se framework může zeptat. Při Zrušit ji router vrátí.
- **Escape a × v okně dialogu** volají `cancel()`, které se zeptá a pak dialog zavře.
- **Zavření nebo obnovení stránky, odkaz mimo aplikaci:** zeptá se prohlížeč svou vlastní otázkou, text nastavit nejde.

Platí to pro komponentu a všechno uvnitř ní: komponentu v presenteru, který odchází, i dialog otevřený z něj. Komponenta, která zůstává, se neptá.

- **`close()` z kódu se neptá:** tlačítka Uložit a Zrušit v dialogu zavírají záměrně. Kdo chce i u svého Zrušit otázku, zavolá `this.cancel()`.
- **Akce presenterů, které zůstávají,** proběhnou ještě před otázkou, jako každá příprava nové obrazovky. Při Zrušit se nic nezmění.
- **Texty:** `messageTexts.unsaved` a `messageTexts.leave`. Ptá se `app.mayLeave(components)`, které jde zavolat i z vlastního kódu.

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

Zavření křížkem, klávesou Escape nebo klikem vedle okna vrátí `undefined`. Dialog zmizí i s komponentou, která ho otevřela.

### Panel z boku

Velký formulář se hodí spíš do panelu, který vyjede zprava přes celou výšku (jako offcanvas v Bootstrapu). Rozhoduje to ten, kdo dialog otevírá, třetím parametrem:

```ts
await this.openDialog(ProjectEdit, {}, { placement: 'end' });

// u routy jako třetí položka
{ name: 'edit', pattern: '/<id \\d+>', dialog: ({ id }) => [ItemEdit, { id: Number(id) }, { placement: 'end' }] }
```

- **`placement`:** `center` (výchozí, okno uprostřed), `end` (panel zprava), `start` (zleva). Panel má hlavičku a patičku na místě a posouvá se jen tělo.
- **`class`:** třídy okna, třeba pro šířku. Šířku panelu mění i proměnná `--phlox-panel-width` (výchozí `min(36rem, 100vw)`).
- **Komponenta se nemění,** stejná může být jednou v okně a jindy v panelu.

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

Výchozí okno je nativní `<dialog>` s částmi `header`, tělem a `footer`. Třídy mu dává téma (viz Vzhled a témata), u výchozího tématu `phlox-dialog`, `phlox-dialog-header` a další. V Bootstrapu vypadá jako jeho modal, se stínem `shadow-lg`.

- **Animace** jsou v `base.css`, takže je má každé téma: okno při otevření sjede shora, panel se objeví a posune se o posledních 50 px ze své strany (nelétá přes celou šířku), pozadí se ztmaví a při zavření vše odejde zpět. Řídí je `setMotion()` (viz Animace), s `off` je vše okamžité.
- **Klik vedle okna** (na ztmavené pozadí) je jako Escape: volá `cancel()`, takže se případně zeptá na neuložené změny. Výběr textu, který skončí mimo okno, okno nezavře.
- **Fokus** po otevření dostane první pole v těle, bez pole celé okno (ne křížek). Prvek s `autofocus` má přednost.
- **Rozbalovací panely** (`Dropdown`, popover u `confirm`) uvnitř dialogu zůstávají v něm, takže nejsou pod jeho pozadím.

Okno dodává služba `Dialogs`. Jinou implementaci, třeba nad Kendo Window, zaregistruješ v kontejneru: `services.add(KendoDialogs)`. Její `show(component, options)` dostane i `DialogOptions` (`placement`, `class`). Zavření okna uživatelem (Escape, ×, klik vedle) musí volat `component.cancel()`, aby se mohl zeptat na neuložené změny.

## Flash zprávy

```ts
this.flashMessage('Uloženo.', 'success');                           // v presenteru
this.flashMessage('Hotovo.', 'info', { duration: 2000 });           // vlastní doba
this.flashMessage('Objednávka odeslána.', 'success', { title: 'Hotovo' });
```

Aplikace zprávy ukazuje jako toasty převzaté z [capify](https://github.com/phloxcz/capify): skládají se v rohu, mají proužek se zbývajícím časem, při najetí myší nebo fokusu čekají a mají křížek. Vzhled dává téma (výchozí, Bootstrap jako `alert`), takže sleduje tmavý režim i přepínač animací.

- **Typy:** `info`, `success`, `warning`, `error`. Chyba se čtečkám ohlásí hned (`role="alert"`), ostatní zdvořile (`role="status"`).
- **Zprávy samy mizí** po 5 sekundách. Chyby zůstávají, dokud je uživatel nezavře, aby je nepřehlédl. Pro celou aplikaci se to nastaví na službě: `app.flashes.duration = 3000`, `app.flashes.errorDuration = 10000` (0 = nezmizí sama).
- **Roh** se nastaví před startem aplikace: `top-right` (výchozí), `top-left`, `top-center`, `bottom-left`, `bottom-center`, `bottom-right`. Třeba vlastní službou: `const flashes = new FlashMessages(); flashes.position = 'bottom-right'; services.add(flashes);`.
- **Rozdíl proti Nette:** tam zpráva přežije přesměrování a ukáže se na další stránce. V SPA se stránka nepřenačítá, takže zprávy fungují jako toasty.
- **Vzhled:** místa `toast.card`, `toast.info`, `toast.success`, `toast.warning`, `toast.error`, `toast.title`, `toast.message`, `toast.close`. **Text** křížku pro čtečky: `messageTexts.close`.

### Zobrazení v layoutu

Kdo chce zprávy vykreslit sám, vypne toasty (`toasts = false`) a zprávy najde v `app.flashes.messages`:

```ts
const flashes = new FlashMessages();
flashes.toasts = false;
services.add(flashes);
```

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

### Zobrazení přes capify

Adaptér pro aplikace, které chtějí přímo knihovnu capify, třeba kvůli stránkám společným s Nette:

```ts
import * as Capify from '@phloxcz/capify';
import '@phloxcz/capify/capify.css';
import { CapifyFlashMessages } from 'phlox-js/adapters/capify';

services.add(new CapifyFlashMessages(Capify, { position: 'top-right', theme: 'bootstrap' }));
```

Druhý parametr jsou volby `Capify.notify()` pro všechny zprávy. Toasty frameworku se pak neukazují. `phlox-js` capify nevyžaduje, instaluje ho aplikace.

## Zprávy a otázky: alert, confirm, prompt

Náhrada `window.alert()`, `confirm()` a `prompt()` převzatá z capify. V komponentě a presenteru jako metody, jinde přes `app`:

```ts
await this.alert('Uloženo.');
if (await this.confirm('Smazat položku?', { danger: true, okText: 'Smazat' })) { … }
const name = await this.prompt('Nový název:', { value: item.name });   // text, nebo null

// Malý popover u tlačítka místo dialogu
<button onClick={async event => {
  if (await this.confirm('Smazat?', { anchor: event.currentTarget, danger: true })) await this.handleDelete();
}}>Smazat</button>

// Dialog bez tlačítek, než něco doběhne
const loading = this.loading('Ukládám…');
loading.update('Ukládám 2 z 5…');
loading.close();
```

- **Dialog** je okno frameworku (nativní `<dialog>`), vypadá jako ostatní dialogy aplikace. `confirm` vrátí `true` pro OK, `false` pro Zrušit, Escape i křížek. `prompt` vrátí text, nebo `null`. Enter v poli potvrdí.
- **Popover** (`anchor: prvek`) se ukáže u prvku, pod ním vlevo, nebo podle `placement` (`bottom-left`, `bottom-right`, `top-left`, `top-right`). Když se nevejde, otočí se. Fokus dostane OK (u `danger` Zrušit) nebo pole, Escape a klik mimo ho zruší, potom se fokus vrátí na prvek. Escape nezavře dialog pod ním.
- **Volby:** `title`, `okText`, `cancelText`, `danger` (OK varuje, třeba u mazání, a fokus dostane Zrušit, aby Enter nic nezničil), u `prompt` `value` a `placeholder`.
- **`loading`** uživatel nezavře, ani Escapem; zavře ho `close()`. Zpráva může být šablona, ne jen text.
- **Zpráva** je text nebo šablona, nikdy HTML v textu, takže nehrozí vložení cizího kódu.
- **Texty tlačítek:** `messageTexts.ok`, `cancel`, `close`, `loading` z `phlox-js` (`unsaved` a `leave` patří k odchodu s neuloženými změnami). **Vzhled:** místa `message.*` (dialog) a `popover.*` (popover; v Bootstrapu jeho `popover` se šipkou).
- **Grid** se před akcí s `confirm` ptá popoverem u tlačítka akce.

## Rozbalovací panel: Dropdown

Tlačítko s panelem libovolného obsahu: menu uživatele, upozornění, filtr.

```tsx
import { Dropdown } from 'phlox-js';

<Dropdown label={<Icon name="bell" />} title="Upozornění" placement="bottom-right" onOpen={() => this.load()}>
  <For each={this.items}>{item => <a href={this.link(`/tasks/${item.taskId}`)}>{item.text}</a>}</For>
</Dropdown>
```

- **Zavření:** klik na odkaz nebo tlačítko v panelu, klik mimo, Escape (zavře jen panel, ne dialog pod ním) nebo druhý klik na tlačítko. Po Escape se fokus vrátí na tlačítko. Zaškrtávátka a pole panel nechají otevřený.
- **Obsah se tvoří při každém otevření** a při zavření se uklidí. `onOpen` se hodí pro načtení dat.
- **Umístění** jako u popoveru: `placement` (`bottom-left` výchozí, `bottom-right`, `top-left`, `top-right`), otočí se, když se nevejde, a posuvný kontejner ho neořízne.
- **Volby:** `label` (obsah tlačítka), `title` (název pro čtečky, když je v tlačítku jen ikona), `class` (třídy tlačítka, může být funkce), `panelClass`.
- **Vzhled:** místa `dropdown.button` a `dropdown.panel`, v Bootstrapu `btn` a `dropdown-menu`.

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
- **`BootstrapTheme`** dává Bootstrap třídy (`form-control`, `form-select`, `is-invalid`, `invalid-feedback`, `btn btn-primary`...) a o vzhled i tmavý režim se stará Bootstrap: tmavý je s `data-bs-theme="dark"` na `<html>`. `default.css` se nenačítá. `color-scheme` stránky má s `data-bs-theme` souhlasit, jinak budou systémové prvky (zaškrtávátka, posuvníky) tmavé na světlé stránce.
- **`base.css`** je jen rozložení (šířka okna dialogu, skrývání přes `toggle()`), potřebuje ho každé téma.
- **Změna jednotlivých tříd:** `new BootstrapTheme({ formRow: 'row mb-2' })`.
- **Ukázky** mají dole přepínač vzhledu (výchozí, Bootstrap), režimu (podle systému, světlý, tmavý) a animací, který si volbu pamatuje. Kód je v `examples/shared/appearance.tsx` a může posloužit jako vzor pro nastavení v aplikaci. Parametr `?theme=bootstrap` nebo `?theme=default` v URL má přednost.

### Tlačítka

Vlastní tlačítka (v `actions()` dialogu, v seznamu, v layoutu) kresli přes `<Button>`, dostanou třídy tématu:

```tsx
import { Button } from 'phlox-js';

<Button onClick={() => this.close(false)}>Zrušit</Button>
<Button primary disabled={() => this.form.submitting()} onClick={() => this.form.submit()}>Uložit</Button>
<Button danger small onClick={event => this.handleDelete(item(), event.currentTarget)}>Smazat</Button>
```

- **Varianty:** bez volby vedlejší (Zrušit, Zavřít), `primary` hlavní akce místa, `danger` akce, která něco zničí. `small` je menší.
- **Je to obyčejný `<button>`:** bere všechny jeho atributy a události, `type` je ve výchozím stavu `button` (ne `submit`). `class` se přidá k třídám tématu.
- **Místa tématu:** `buttonPrimary`, `buttonSecondary`, `buttonDanger`, `buttonSmall`. V Bootstrapu `btn btn-primary`, `btn btn-outline-secondary`, `btn btn-danger`, `btn-sm`.

### Animace

Animace frameworku (rozbalování stromu, uhýbání při řazení, otáčení šipek a jiné přechody) mají jeden přepínač:

```ts
import { setMotion } from 'phlox-js';

setMotion('system');   // výchozí: podle nastavení systému „omezit pohyb“
setMotion('on');       // vždy, i když systém žádá omezení
setMotion('off');      // nikdy
```

- **Platí pro všechny prvky,** i budoucí. Volbu uživatele si aplikace uloží sama (třeba do `localStorage`) a při startu ji nastaví.
- **`motion()`** vrací aktuální volbu a je reaktivní, hodí se pro přepínač v nastavení. **`allowsMotion()`** řekne, jestli se teď smí animovat.
- **Vlastní animace** se mohou řídit stejně: v JS se zeptej `allowsMotion()`, v CSS vynásob délku proměnnou `--phlox-motion` (1 nebo 0): `transition: opacity calc(.2s * var(--phlox-motion));`. Proměnnou nastavuje `base.css` podle atributu `data-phlox-motion` na `<html>` a podle nastavení systému.
- **Ukazatele stavu se točí dál,** třeba kolečko načítání ve stromu. Nejsou ozdoba, říkají, že se něco děje.

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
| `buttonPrimary`, `buttonSecondary`, `buttonDanger`, `buttonSmall` | `<Button>` |
| `invalid`, `error` | prvek s chybou, text chyby |
| `checkbox`, `checkboxInput`, `radioList`, `checkboxList`, `choiceItem`, `choiceInput` | checkboxy a výběry |
| `dialog`, `dialogContent`, `dialogHeader`, `dialogTitle`, `dialogClose`, `dialogBody`, `dialogFooter` | okno dialogu |
| `dropdown.button`, `dropdown.panel` | `<Dropdown>` |

Místo, které téma nemá, dostane prázdnou třídu. Vlastní prvky si mohou zavést svá místa, třeba `dropdownlist.wrapper`, a číst je přes `currentTheme().class('dropdownlist.wrapper')` (`currentTheme` z `phlox-js`).

## Adaptéry: napojení jiných knihoven

Části, které jdou vyměnit, jsou služby v kontejneru. Adaptér je třída, která službu nahradí: zaregistruješ ji v `services.ts` a framework ji použije místo výchozí. Presentery a komponenty se nemění.

| Služba | Výchozí | K čemu adaptér |
|---|---|---|
| `FlashMessages` | zprávy pro layout, s časovačem | `CapifyFlashMessages` (`phlox-js/adapters/capify`), jiná knihovna toastů |
| `Dialogs` | nativní `<dialog>` | `KendoDialogs` (Kendo Window), okna jiné knihovny |
| `Theme` | výchozí třídy `phlox-*` | `BootstrapTheme`, jiný CSS framework |
| `Translator` | `IntlTranslator` | i18next nebo jiný překladač |
| `UserStorage` | `sessionStorage` | `localStorage`, cookies |
| `Preferences` | `localStorage` (`BrowserPreferences`) | nastavení uživatele na serveru |
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

## Kendo UI

Adaptér `phlox-js/adapters/kendo` napojí Kendo UI for jQuery, podobně jako knockout-kendo v Knockoutu: widgety svázané se `state`, zničené spolu se svou částí šablony, Kendo Grid, dialogy v Kendo Window a widgety jako prvky formulářů. Celé je to vidět v ukázce [examples/kendo](../examples/kendo/main.ts).

### Zapojení

`phlox-js` Kendo neimportuje, aplikace ho adaptéru předá. Kendo hledá jQuery ve `window`, proto se nastaví před importem Kenda:

```ts
// main.ts
import '@progress/kendo-theme-bootstrap/dist/bootstrap-main.css';
import 'phlox-js/adapters/kendo/kendo.css';
import jQuery from 'jquery';
import { setScriptKey } from '@progress/kendo-licensing';

setScriptKey(import.meta.env.VITE_KENDO_LICENSE);     // licenční klíč z .env.local, ne z gitu
Object.assign(window, { jQuery, $: jQuery });
const { default: kendo } = await import('@progress/kendo-ui');

// services.ts
services.add(new Kendo(kendo), KendoDialogs);          // KendoDialogs: dialogy v Kendo Window
```

- **Licence:** bez klíče Kendo funguje, ale ukazuje upozornění zkušební verze a vodoznak. Klíč patří do `.env.local` (`VITE_KENDO_LICENSE=…`), soubory `*.local` git ignoruje.
- **Typy Kenda** jsou globální jmenný prostor, ne modul. Pro `import()` stačí v projektu deklarace modulu, viz `examples/kendo/env.d.ts`.

### Widget v šabloně: `KendoWidget`

```tsx
import { KendoWidget } from 'phlox-js/adapters/kendo';

readonly status = state<string>('');

<KendoWidget widget="DropDownList" value={this.status} enabled={() => !this.saving()}
  options={{ dataSource: statuses, dataTextField: 'text', dataValueField: 'value' }} />
```

- **`widget`** je název v `kendo.ui` (`DatePicker`, `DropDownList`, `Editor`, `Upload`…), **`options`** jeho volby z dokumentace Kenda. Čtou se jednou, při vytvoření widgetu.
- **`value`** je `state` v obou směrech: změna stavu nastaví widget, změna ve widgetu nastaví stav. Data se porovnávají podle času, seznamy podle obsahu.
- **`enabled`** je stav nebo funkce. **`onCreate(widget, element)`** dá widget pro jeho vlastní metody a události.
- **Widget vznikne,** až je prvek ve stránce, na `<input>` u widgetů hodnot, jinak na `<div>` (jinak `tag`). Když jeho část šablony zmizí (`<If>`, řádek `<For>`, zavřený dialog), zavolá se `destroy()` a nezůstane po něm nic, ani obaly, které si Kendo kolem prvku přidá.

### Kendo Grid: `KendoGrid`

```tsx
<KendoGrid<Order>
  data={this.shown}                                     // state nebo computed s řádky
  options={{ sortable: true, pageable: { pageSize: 10 }, dataSource: { pageSize: 10 } }}
  columns={[
    { field: 'id', title: 'Číslo' },
    { field: 'customer', title: 'Zákazník', render: order => <a href={this.link('edit', { id: order.id })}>{order.customer}</a> },
    { field: 'price', title: 'Cena', format: '{0:n0} Kč' },
  ]}
  onSelect={order => this.selected.set(order)}          // s options.selectable
/>
```

- **`data`** se sleduje: změna stavu (hledání, filtr mimo grid, uložená změna) ukáže nové řádky a grid si nechá řazení i stránkování. Pro data ze serveru dej `options.dataSource` s `transport` jako v Kendu a `data` vynech.
- **`render`** u sloupce kreslí buňku šablonou frameworku místo HTML řetězce Kenda: odkazy, které aplikace zachytí, komponenty, reaktivní text. Při každém překreslení řádků se staré buňky uklidí.
- **Ostatní volby sloupců** (`template`, `format`, `attributes`, `width`…) jsou Kenda beze změny.
- **`onSelect`** dostane řádek jako objekt z `data`, ne kopii, kterou si Kendo dělá.

### Dialogy v Kendo Window: `KendoDialogs`

S `KendoDialogs` v kontejneru se každý dialog frameworku otevře v Kendo Window: `openDialog()`, dialogy rout i `alert`, `confirm` a `prompt`. Komponenty se nemění, `title()` je titulek okna, `render()` obsah, `actions()` tlačítka dole. × a Escape v okně volají `cancel()`, takže se zeptají na neuložené změny. `placement: 'end'` nebo `'start'` dá okno jako panel u okraje přes celou výšku.

### Widget jako prvek formuláře: `KendoControl`

```ts
this.form.addControl('date', new KendoControl<Date>('DatePicker', 'Datum', { format: 'd. M. yyyy' }))
  .setRequired('Vyberte datum.');
this.form.addControl('status', new KendoControl<Status>('DropDownList', 'Stav', { dataSource: statuses, dataTextField: 'text', dataValueField: 'value' }));
```

- **Chová se jako prvky frameworku:** pravidla, `<Label>` (vede na pole widgetu), chyby u pole i ze serveru, `setDefaults`, `isChanged()`, `setDisabled()`, kontrola po opuštění celého widgetu.
- **Hodnota** je to, co dává `value()` widgetu: `Date` u DatePickeru, číslo u NumericTextBoxu, hodnota položky u DropDownListu.
- **Chybné pole** dostane třídu tématu (`is-invalid` v Bootstrapu, `phlox-invalid` ve výchozím) a `kendo.css` mu obarví rámeček.

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
- **Názvy metod v URL:** požadavek jde na `/rpc?task.read,comment.list`, takže je v záložce Síť v prohlížeči vidět, co volá (u dávky každá metoda jednou). Server query ignoruje. Vypíná se volbou `methodsInUrl: false`.

### Soubory přes RPC

JSON-RPC přenáší jen text. `fileChunks(file, size)` z `phlox-js/net` přečte soubor po částech (výchozí 1 MB) a každou vrátí v base64, takže velký soubor nikdy není v paměti celý:

```ts
for await (const chunk of fileChunks(file)) {
  // chunk: { index, total, offset, data }, prázdný soubor má jednu prázdnou část
  await this.api.call('file.chunk', { uploadId, ...chunk });
}
```

Base64 je o třetinu větší než soubor. Na velké soubory je lepší REST API: `fetch(url, { method: 'PUT', body: file })` pošle soubor proudem.

### Mock server

`createRpcMock` z `phlox-js/net` je falešný server z tabulky metod, pro testy i pro vývoj bez backendu, viz Testování aplikací.

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

## Práce offline

Aplikace může pracovat bez signálu: data, která uživatel otevřel nebo si připravil, má k dispozici, a co udělá, odešle se po návratu signálu. Celé je to vidět v helpdesku (tlačítko „Připravit pro offline“ u seznamu úkolů).

```ts
import { IndexedDbStore, RpcOffline } from 'phlox-js/net';

class AppOffline extends RpcOffline<RpcMethods> {}     // vlastní třída, aby ji služby našly podle typu

const offline = new AppOffline(new IndexedDbStore('moje-aplikace'), {
  reads: {
    'task.read': {},                                   // výsledek se ukládá a offline vrací
    'task.list': { offline: async ({ query }, cache) => filtruj((await cache.all('task.read')).map(e => e.value), query) },
  },
  writes: {
    'task.update': {
      apply: async ({ id, input }, cache) => {          // promítne změnu do uložených dat, vrátí výsledek
        const task = { ...(await cache.get('task.read', { id })), ...input };
        await cache.set('task.read', { id }, task);
        return task;
      },
      version: async ({ id }, cache) => (await cache.get('task.read', { id }))?.updated,
      current: async ({ id }, call) => (await call('task.read', { id })).updated,
      describe: ({ id }) => `Změna úkolu ${id}`,
    },
  },
}, () => String(user.getId()));                        // data a fronta patří přihlášenému uživateli

services.add(offline, new RpcApi('/rpc', { offline }));
```

- **Čtení:** každá metoda z `reads` se online volá normálně a výsledek se uloží. Offline (nebo při chybě sítě) se vrátí uložený. Když tentýž dotaz uložený není, zkusí se `offline`, který odpověď spočítá z jiných uložených dat, třeba seznam s jiným filtrem z uložených úkolů. Jinak chyba sítě (`RpcError` s kódem 0).
- **Zápis:** metoda z `writes` jde online rovnou na server. Offline se uloží do fronty a vrátí výsledek z `apply`, takže obrazovky změnu ukážou hned.
- **Příprava pro offline:** `await offline.download([['project.list'], ['task.read', { id: 5 }], …])` stáhne a uloží data dopředu, volání jdou jednou dávkou. `offline.downloaded()` je čas poslední přípravy.
- **Odeslání:** samo po návratu signálu a ručně `offline.sync()`. Fronta je v IndexedDB, přežije zavření aplikace. `offline.onSynced(() => app.invalidate('tasks'))` načte obrazovky znovu.
- **Záznam změněný mezitím:** s `version` a `current` se před odesláním porovná verze záznamu (třeba čas poslední změny) s tou na serveru. Liší-li se, změna čeká v `offline.conflicts()` a aplikace se zeptá; `offline.resolve(změna, 'send' | 'drop')`.
- **Odmítnuté změny** (validace, oprávnění) jsou v `offline.failed()` s důvodem: `offline.retry(změna)`, `offline.drop(změna)`. Čekající v `offline.pending()`, průběh v `offline.syncing()`. Vše je `state`, takže jde rovnou do šablony.
- **`online()`** z `phlox-js/net` je stav připojení: `<If when={() => !online()}>Offline</If>`.
- **Testy** dostanou `MemoryStore` místo `IndexedDbStore` (jsdom IndexedDB nemá).
- **Kostra aplikace offline (PWA):** `vite-plugin-pwa` v konfiguraci Vite uloží stránku, JS a CSS do service workeru. V helpdesku je nastavení v `examples/vite.config.ts` a registrace s nabídkou nové verze v `examples/helpdesk/main.ts`. Funguje v sestavené verzi (`npm run build:examples`, pak `npx vite preview --config examples/vite.config.ts`), dev server ji nemá.

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

Přesměrování ze `startup()` nebo akce zastaví celou navigaci, takže chráněná obrazovka se neobjeví ani na okamžik.

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
- **`form.isChanged()`** je `true`, když se hodnoty liší od uložených (reaktivně, jde dát do šablony). Uložené jsou hodnoty z `setDefaults()`, po úspěšném `onSuccess`, po `reset()`, jinak ty, které měl formulář při prvním vykreslení. Změna tam a zpět se nepočítá. `form.markSaved()` označí aktuální hodnoty za uložené, když se ukládá mimo `onSuccess`. Slouží hlavně pro `hasUnsavedChanges()`, viz Odchod s neuloženými změnami.

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
| `addUpload(name, label)` | `File` nebo `null` (viz Soubory) |
| `addMultiUpload(name, label)` | `File[]` (viz Soubory) |
| `addTreeSelect(name, label, options)` | id uzlu stromu nebo `null` (viz Výběr ze stromu) |
| `addTreeMultiSelect(name, label, options)` | pole id uzlů stromu |
| `addDropDownTreeSelect(name, label, options)` | id uzlu stromu nebo `null`, strom v rozbalovacím panelu |
| `addHidden(name, value)` | text |
| `addSubmit(name, caption)` | tlačítko, mezi hodnotami není |
| `addContainer(name, label)` | vnořený objekt, viz Kontejnery a řádky |
| `addMultiplier(name, factory, options)` | seznam objektů, řádky, které uživatel přidává a řadí |

**Položky** výběrů se zadávají jako dvojice `[[1, 'Nízká'], [2, 'Vysoká']]`, jako objekt `{ 1: 'Nízká' }`, ve kterém se celočíselné klíče převedou na čísla jako v PHP, nebo jako seznam hodnot, které jsou zároveň popisky: `['Albert', 'Billa']`. Přijít mohou i později, třeba ze serveru: `control.setItems(...)`.

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

- **Pravidla:** `Filled` (= `Required`), `Blank`, `Equal`, `NotEqual`, `MinLength`, `MaxLength`, `Length`, `Email`, `URL`, `Pattern`, `Integer`, `Float`, `Min`, `Max`, `Range`, `IsIn`, pro soubory `MaxFileSize`, `MimeType` a `Image`. `Min` a `Max` porovnávají i data: `addRule(Form.Min, 'Termín nesmí být v minulosti.', today)`.
- **Vlastní pravidlo** je funkce `(control, arg) => boolean`: `addRule(control => control.getValue() !== 'admin', 'Toto jméno je vyhrazené.')`.
- **Jako v Nette se pravidla kontrolují jen u vyplněného prvku,** kromě `setRequired`. Prázdné nepovinné pole s `Form.Email` je tedy v pořádku.
- **U prvku se hlásí jen první chyba.**
- **Zástupné hodnoty v hláškách:** `%d` a `%s` podle argumentů, `%label`, `%name`, `%value`.
- **Výchozí hlášky** jsou anglicky. Pro jazyk aplikace je přepiš jednou při startu: `Form.messages.set(Form.Filled, 'Vyplňte %label.')`.
- **`toggle(id)`** v podmínce zobrazí prvek s tím id, jen když podmínka platí: `form.get('done').addCondition(Form.Filled).toggle('note-pair')`.

### Kdy se kontroluje

- **Při odeslání** se zkontroluje celý formulář. Když neprojde, zavolá se `onError`, u polí se objeví chyby a kurzor skočí na první chybné pole. Při úspěchu se zavolá `onSuccess`.
- **Během psaní:** po opuštění pole, které uživatel změnil, se kontroluje živě. Chyba zmizí, jakmile ji uživatel opraví.
- **Pole, na které uživatel nesáhl,** se při opuštění nekontroluje: projití prázdného povinného pole Tabem chybu neukáže, ukáže ji až odeslání. U dropdownlistu a stromu v panelu se počítá i otevření seznamu.
- **`form.reset()`** vrátí formulář do stavu nového, pole se pak zase chovají jako nedotčená. Hodí se po odeslání komentáře, kdy pole zůstává ve fokusu.
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
- **Prvek** dá `<Input control={text} ref={element => …} />`, nebo kdykoli později `control.element`.

### Hodnota prvku jinde na stránce

`control.value` je hodnota prvku jako stav (`state`). Dej ji do šablony bez volání a text sleduje psaní, jako binding v MVVM (v Knockoutu `text: name`). Nic se nepropojuje ručně:

```tsx
const name = this.form.get('name');

<h2>{name.value}</h2>                                 // mění se při psaní
<h2>{() => name.value() || 'Nová kategorie'}</h2>    // s úpravou: funkce, ve které se hodnota přečte
<p>{() => `${name.value().length} / 40 znaků`}</p>
```

- **Bez závorek, nebo ve funkci:** `{name.value}` předá šabloně funkci a ta ji sleduje. `{name.value()}` se závorkami přečte hodnotu jen jednou při vykreslení (viz Co je reaktivní). `name.value()` je totéž co `name.getValue()`.
- **Proč ne `{this.form.get('name')}`:** prvek v šabloně by mohl znamenat pole i hodnotu. Pole vykresluje `<Input control={…} />`, hodnotu `.value`.
- **Proč ne `this.form['name']` jako v Nette:** třída v TypeScriptu neumí přístup přes hranaté závorky typovaný podle DTO, aniž by se názvy polí tloukly s metodami formuláře (`reset`, `errors`…). `get('name')` kompilátor hlídá.
- **Zápis:** `name.value.set('Pánve')` nebo `name.value.update(text => text.trim())` zapíše hodnotu do pole, stejně jako `name.setValue()`.
- **Celý formulář:** `computed(() => this.form.getValues())` sleduje všechny prvky, i v kontejnerech a řádcích. Tak vzniká třeba živý součet faktury (viz Kontejnery a řádky).
- **Hodnota se mění při psaní,** ne až po uložení. Uložený stav (třeba název v jiném seznamu) se změní, až ho aplikace po uložení načte znovu.

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
form.addComboBox('shop', 'Obchod:', { items: shops, allowCustom: true });
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
form.addTagInput('labels', 'Štítky:', { items: labels, allowNew: true, maxTags: 5 });
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

### Soubory

Drop zóna s tlačítkem a tabulka vybraných souborů, vzhled převzatý z [phloxcz/components-upload](https://github.com/phloxcz/components-upload). **Nic se nenahrává:** hodnotou jsou objekty `File` a co s nimi, rozhodne `onSuccess`. Jako v Nette, kde `addUpload()` předá `FileUpload` a uložení je na presenteru.

```ts
// Typ formuláře, ne vygenerované DTO: to typ File nemá
interface ArticleInput { title: string; cover: File | null; attachments: File[] }

this.form.addUpload('cover', 'Obrázek:')
  .addRule(Form.Image, 'Jen obrázek.')
  .addRule(Form.MaxFileSize, 'Nejvýš 5 MB.', 5 * 1024 * 1024);
this.form.addMultiUpload('attachments', 'Přílohy:')
  .addRule(Form.MaxLength, 'Nejvýš %d souborů.', 10);

this.form.onSuccess = async values => {
  const id = await this.api.call('article.create', { input: { title: values.title } });
  // Přes RPC po částech v base64 (viz Soubory přes RPC)...
  for (const file of values.attachments) {
    for await (const chunk of fileChunks(file)) {
      await this.api.call('article.attachmentChunk', { id, name: file.name, ...chunk });
    }
  }
  // ...nebo proudem do REST API
  if (values.cover) await fetch(`/api/articles/${id}/cover`, { method: 'PUT', body: values.cover });
};
```

- **Hodnota:** `addUpload` dává `File` nebo `null`, `addMultiUpload` `File[]`. Kompilátor dovolí `addUpload` jen na pole typu `File | null` a `addMultiUpload` jen na `File[]`. Formulář s uploadem má proto vlastní typ, ze kterého obsluha sestaví volání API.
- **Výběr:** klik na zónu nebo tlačítko, Enter nebo mezerník na zóně, klik na popisek, přetažení souborů na zónu. U jednoho souboru nový výběr nahradí starý. U více souborů se přidávají a stejný soubor (název, velikost, datum změny) se nepřidá dvakrát.
- **Seznam:** název (dlouhý se zkrátí), velikost, u obrázků náhled, křížek pro odebrání.
- **Pravidla** se kontrolují hned po výběru. `MaxFileSize` (v bajtech), `MimeType` (`'application/pdf'`, `['text/plain', 'image/*']`) a `Image` (JPEG, GIF, PNG, WebP, AVIF jako v Nette) platí pro každý soubor a soubor, který je porušuje, se v seznamu označí. Počet souborů hlídají `MinLength`, `MaxLength` a `Length`, povinnost `setRequired()`.
- **Atribut `accept`** se doplní z pravidel `MimeType` a `Image`, takže dialog prohlížeče rovnou nabídne jen vhodné soubory. Pravidla platí dál, přetažený soubor `accept` neomezí.
- **`setValue()`** a `reset()` fungují jako u jiných prvků. Soubory přidá i kód: `control.addFiles(files)`.
- **Existující soubory** záznamu (už uložené přílohy) upload neukazuje, vykresli je zvlášť.
- **Texty:** `UploadControl.texts.heading`, `or`, `browseMultiple`, `browseSingle`, `dropzone` (popis zóny pro čtečky), `remove` (`%s` je název souboru). **Vzhled:** místa `upload.dropzone`, `upload.dropzoneIdle`, `upload.dropzoneActive`, `upload.button`, `upload.table`, `upload.row`, `upload.rowError`, `upload.cellName`, `upload.cellSize`, `upload.cellRemove`, `upload.remove`. Třídy `pu-*` z PHP knihovny jsou v každém tématu.
- **Velikost** pro lidi: `formatFileSize(3_400_000)` vrátí `3.2 MB`.

### Výběr ze stromu

Strom přímo ve formuláři, u každého uzlu přepínač nebo zaškrtávátko, jako picker z [phloxcz/components-tree](https://github.com/phloxcz/components-tree). Uzly se zadávají stejně jako u stromu (viz Strom):

```ts
// Jeden uzel: id nebo null
form.addTreeSelect('parentId', 'Nadřazená kategorie:', {
  load: parent => this.api.call('category.children', { parentId: parent?.id ?? null }),
  path: id => this.api.call('category.path', { id }),
  lines: true,
}).setRequired('Vyberte kategorii.');

// Několik uzlů: pole id
form.addTreeMultiSelect('pageIds', 'Stránky:', { nodes: pages });
```

- **Hodnota** je id uzlu (typ podle DTO, třeba `number | null`), u více uzlů pole id. Uzly jsou na sobě nezávislé: zaškrtnutí rodiče neznamená zaškrtnutí dětí.
- **Vybírá se** klikem kamkoli na řádek, nebo mezerníkem či Enterem na uzlu. Šipky procházejí strom jako u stromu.
- **Vybraný uzel hluboko v líném stromu** se ukáže, když má strom `path`: po `setDefaults({ parentId: 121 })` se načte a rozbalí cesta k němu.
- **Kontrola** proběhne po opuštění stromu, po první chybě živě. Fokus po chybě dostane vybraný nebo první uzel.
- **Strom prvku** je `control.tree`, třeba pro `control.tree.reload()` po změně na serveru.
- **Vzhled:** obal má třídu `phlox-treeselect` a místo tématu `treeselect`. Delší strom omez výškou: `.phlox-treeselect { max-height: 16rem; overflow: auto; }`.

### Rozbalovací výběr ze stromu

Jeden uzel stromu v rozbalovacím panelu, vypadá a ovládá se jako dropdownlist. Zavřený ukazuje cestu od kořene k vybranému uzlu, otevřený strom:

```ts
form.addDropDownTreeSelect('parentId', 'Nadřazená kategorie:', {
  load: parent => this.api.call('category.children', { parentId: parent?.id ?? null }),
  path: id => this.api.call('category.path', { id }),
  placeholder: 'Žádná, horní úroveň',
});
// zavřený: „Domácnost › Kuchyně › Nože“
```

- **Hodnota** je id uzlu nebo `null`. Uzly se zadávají stejně jako u stromu (`nodes`, nebo `load` s `path`).
- **Cesta v tlačítku** se skládá z popisků uzlů. Hodnota nastavená z kódu hluboko v líném stromu si cestu načte přes `path`, mezitím je v tlačítku `…`. Bez `path` umí líný strom ukázat jen načtené uzly, jinak ukáže id. Celá cesta je i v `title`, kdyby se do tlačítka nevešla. Oddělovač mění volba `separator` (výchozí ` › `).
- **Otevření:** klik, šipka dolů, Enter nebo mezerník. Strom ukáže cestu k vybranému uzlu a dá na něj fokus. Panel se otevře pod tlačítkem, nebo nad ním, když dole není místo.
- **Výběr:** klik na uzel, nebo Enter či mezerník. Panel se zavře a fokus se vrátí na tlačítko. Escape zavře jen panel, ne dialog kolem.
- **Vymazání:** u nepovinného prvku křížek v tlačítku, nebo Delete či Backspace na tlačítku.
- **`lines`** zapne čáry stromu v panelu. **Strom prvku** je `control.tree`, třeba pro `control.tree.reload()`.
- **Vzhled** je dropdownlistu (místa `dropdownlist.wrapper`, `dropdownlist.trigger`, `dropdownlist.dropdown`), obal má navíc třídu `phlox-dropdowntree` a panel `phlox-dropdowntree-panel`. **Texty:** `DropDownTreeSelect.texts.clear`.

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

### Položky jako objekty a vlastní šablona

Dropdownlist, combobox i taginput berou položky i jako objekty, třeba uživatele rovnou ze serveru, a mohou je kreslit vlastní šablonou:

```tsx
form.addDropDownList('assigneeId', 'Řešitel', {
  items: users,                                  // UserResource[], nebo search, který objekty vrací
  itemValue: user => user.id,                    // hodnota prvku
  itemLabel: user => user.name,                  // text: hledání, čtečky, pole comboboxu
  template: user => <span><Avatar user={user} /> {user.name}</span>,
});
```

- **`itemValue` zapíná objekty** a je pak povinné. Kompilátor hlídá, že vrací typ pole z DTO, a `user` v ostatních funkcích má typ položek.
- **`itemLabel`** je text položky. Hledá se v něm (u `items` bez ohledu na diakritiku), čte ho čtečka a je v poli comboboxu. Bez něj je textem hodnota.
- **`template`** kreslí položku v seznamu, ve vybrané hodnotě dropdownlistu a ve štítcích taginputu. Combobox ji má jen v seznamu, v poli je text. Se šablonou se hledaný text nezvýrazňuje.
- **Hodnota z kódu** se nakreslí šablonou, když je její objekt mezi načtenými položkami. Jinak jde objekt předat s hodnotou (`setValue(5, user)`, u taginputu `setValue(ids, users)`), nebo ho vrátí volba `label` místo textu. Bez objektu se ukáže jen text.
- **Výčet hodnot se šablonou:** `items: ['open', 'closed'], itemValue: status => status, template: status => <StatusLabel status={status} />`.
- **Typ voleb** pro vlastní pomocné funkce: `DropDownListOptions<T, O>`, `ComboBoxOptions<T, O>`, `TagInputOptions<T, O>`. Jsou to sjednocení dvou tvarů (hodnoty, nebo objekty s `itemValue`), takže `Omit<…>` na ně nefunguje, použij průnik: `ComboBoxOptions<number> & { allowCustom?: false }`.

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
- **Escape** tažení ukončí. Položka zůstane tam, kam už dojela, protože se v datech přesouvá průběžně.
- **U okraje se posouvá:** když ukazatel dojede k okraji, posouvá se nejbližší posuvný prvek kolem seznamu (třeba dialog nebo box s `overflow: auto`), jinak stránka. Čím blíž okraji, tím rychleji. Funguje svisle i vodorovně a zastaví se na konci obsahu.
- **Úchyt potřebuje CSS `touch-action: none`,** jinak prstem posouvá stránku.

### Vlastní prvek

Prvek je potomek `FormControl<T>` s metodami `getValue()`, `setValue()`, `isFilled()` a `render(attributes)`. Do formuláře se přidá přes `form.addControl('name', new MyControl('Popisek:'))`. Pravidla, `<Label>`, `<Input>`, chyby ze serveru i hodnoty pak fungují jako u vestavěných prvků. Tak vzniknou i combobox, dropdownlist a taginput.

## Strom

Strom jako [phloxcz/components-tree](https://github.com/phloxcz/components-tree), se stejným HTML, třídami a CSS. Importuje se z `phlox-js/components`. Stejně jako u formuláře je zvlášť model (`Tree`) a vykreslení (`<TreeView>`).

```tsx
import { Tree, TreeView } from 'phlox-js/components';

class CategoriesPresenter extends Presenter {
  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'detail', pattern: '/<id \\d+>' },
  ];

  tree = new Tree<CategoryNode>({
    load: parent => this.api.call('category.children', { parentId: parent?.id ?? null }),
    path: id => this.api.call('category.path', { id }),
    remember: 'categories',
    draggable: true,
    move: ({ node, parent, index }) => this.api.call('category.move', { id: node.id, parentId: parent?.id ?? null, index }),
  });

  constructor(private api: RpcApi) {
    super();
  }

  override async startup() {
    await this.tree.load();
  }

  async actionDetail({ id }: Params) {
    await this.tree.select(Number(id));   // označí uzel a rozbalí cestu k němu
  }

  render() {
    return <TreeView tree={this.tree} lines href={node => this.link('detail', { id: node.id })} />;
  }
}
```

Celá ukázka je v `examples/tree` (`npm run dev`, stránka `/tree`).

### Uzly

Uzel je objekt s `id`, `label` a volitelně `children`, `hasChildren` a `disabled`. Další pole strom předává dál beze změny, takže typ uzlu může být rozšířený: `interface CategoryNode extends TreeNode<number> { locked?: boolean }`.

- **Najednou:** `new Tree({ nodes })`, děti v `children`. Uzel bez dětí je list.
- **Po úrovních:** `new Tree({ load })`. `load(null)` vrátí horní úroveň, `load(node)` děti uzlu, až když ho uživatel rozbalí. Uzel, který děti má, potřebuje `hasChildren: true`, jinak se nedá rozbalit. Děti uvedené v `children` se nenačítají.
- **`path(id)`** vrátí id předků uzlu od kořene. Bez něj umí `select()` a výběr ve formuláři ukázat jen uzel, který už je načtený.
- **`tree.load()`** načte horní úroveň jednou, `<TreeView>` ho zavolá sám. Když má být strom hotový dřív (třeba pro `select()` v akci), počkej na něj ve `startup()`. **`tree.reload()`** načte strom znovu, třeba po změně na serveru.

### Výběr a URL

- **Klik na uzel nebo Enter** uzel vybere (`tree.selected()`) a zavolá `tree.onSelect(node)`.
- **S `href`** je popisek odkaz a výběr uzlu na něj přejde. Router tak dostane URL uzlu a akce presenteru zavolá `tree.select(id)`. Výběr tedy vždy odpovídá URL, i po přímém odkazu, obnovení stránky a tlačítkách Zpět a Vpřed.
- **`tree.select(id)`** z kódu uzel označí a rozbalí cestu k němu. `onSelect` nevolá, aby výběr z URL znovu nenavigoval. `tree.select(null)` výběr zruší.
- **Zakázaný uzel** (`disabled`) nejde vybrat, zaškrtnout ani přetáhnout.

### Rozbalování a vzhled

- **Šipka u uzlu** ho rozbalí nebo sbalí, během načítání se ukáže kolečko a uzel má `aria-busy`. Když načtení selže, uzel zůstane sbalený a chyba jde do `app.onError`.
- **Rozbalení a sbalení se animuje,** délku dává CSS proměnná `--pt-anim-duration` (výchozí 180 ms, `0ms` animaci vypne). Zapnutí a vypnutí řídí `setMotion()` (viz Animace), ve výchozím stavu podle nastavení systému. Při prvním vykreslení se neanimuje.
- **`remember: 'klíč'`** si rozbalené uzly pamatuje v prohlížeči (`localStorage`). Po načtení se znovu rozbalí, u líného stromu i s načtením dětí.
- **Z kódu:** `tree.expand(item)`, `tree.collapse(item)`, `tree.toggle(item)`, `tree.reveal(id)` (rozbalí cestu bez výběru). `tree.find(id)` vrátí načtený uzel jako `TreeItem` se stavem: `expanded()`, `children()`, `loading()`, `parent()`, `hasChildren()`.
- **`<TreeView>`:** `lines` (spojovací čáry), `href`, `icon={(node, item) => ...}`, `label={node => ...}`, `aria-label`, `class`.
- **Vzhled** dodává téma: místa `tree.root`, `tree.row`, `tree.rowSelected`, `tree.toggle`, `tree.label`, `tree.pick` (zaškrtávátko nebo přepínač výběru, v Bootstrapu `form-check-input`). Rozměry jdou změnit proměnnými jako v PHP knihovně: `--pt-row-height`, `--pt-indent-width`, `--pt-font-size`… CSS je v `base.css` a nemá pevné barvy.
- **Texty:** `Tree.texts.expand`, `collapse`, `loading`.

### Klávesnice

Podle vzoru stromu z WAI-ARIA. Tabulátorem jde jen na jeden uzel (vybraný, jinak první), dál se pokračuje šipkami.

| Klávesa | Co udělá |
|---|---|
| ↓ ↑ | další a předchozí viditelný uzel |
| → | rozbalí uzel, na rozbaleném přejde na první dítě |
| ← | sbalí uzel, na sbaleném přejde na rodiče |
| Home, End | první a poslední viditelný uzel |
| Enter, mezerník | vybere uzel (s `href` na něj přejde), ve výběru ve formuláři ho zaškrtne |
| `*` | rozbalí všechny sourozence |
| písmena | přejde na uzel, který jimi začíná, bez ohledu na diakritiku |

### Přetahování

- **`draggable: true`**, nebo funkce, která řekne, které uzly jde přetáhnout: `draggable: node => !node.locked`.
- **Kam uzel půjde,** určuje poloha nad řádkem: horní čtvrtina znamená před uzel, dolní za něj, prostředek dovnitř jako poslední dítě. Místo ukazuje atribut `data-drop-pos` (`before`, `after`, `child`) a čára nebo rámeček. Kopie řádku jede vedle ukazatele, uzel zůstává na místě zesvětlený.
- **Sbalený uzel se rozbalí,** když nad jeho prostředkem tažený uzel chvíli zůstane. U okraje se seznam nebo stránka posouvá.
- **Nejde** pustit uzel na sebe, do svého podstromu ani znovu do svého rodiče. Escape tažení zruší.
- **`move({ node, target, position, parent, index })`** se zavolá po přesunu: `parent` je nový rodič (`null` pro horní úroveň) a `index` pozice mezi jeho dětmi. Když `move` skončí chybou (server přesun odmítl), uzel se vrátí na původní místo a chyba jde do `app.onError`.
- **Z kódu:** `await tree.move(item, target, 'child')`.
- **Prstem** se uzel přetahuje po podržení: prst musí chvíli (0,4 s) stát na místě, pak se objeví kopie řádku a telefon krátce zavibruje. Rychlý tah prstem dál posouvá stránku. Během tažení se stránka pod prstem neposouvá (kromě posouvání u okraje) a neotevře se nabídka prohlížeče.

## Grid

Tabulka dat jako [phloxcz/components-grid](https://github.com/phloxcz/components-grid), se stejným HTML, třídami a CSS. Importuje se z `phlox-js/components`. Model (`Grid`) a vykreslení (`<GridView>`) jsou zvlášť jako u formuláře a stromu.

```tsx
import { Grid, GridView } from 'phlox-js/components';

class OrdersPresenter extends Presenter {
  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'detail', pattern: '/<id \\d+>', dialog: ({ id }) => [OrderDetail, { id: Number(id) }] },
  ];

  grid = new Grid<Order>({
    load: query => this.api.call('order.query', { query }),   // { page, pageSize, sort, search, filter } → { data, total }
    pageSize: 20,
    pageSizes: [10, 20, 50],
    remember: 'orders',
  });

  constructor(private api: RpcApi) {
    super();
    this.grid.addNumberColumn('id', 'Číslo').sortable();
    this.grid.addTextColumn('customer', 'Zákazník').sortable().filterable();
    this.grid.addTextColumn('category', 'Kategorie').filterSelect(categories, true);
    this.grid.addNumberColumn('price', 'Cena').sortable().filterable().format(price => money.format(price)).aggregate('sum');
    this.grid.addDateColumn('created', 'Vytvořeno').sortable().filterable();
    this.grid.addBoolColumn('paid', 'Zaplaceno').filterable();
    this.grid.addColumn('product', 'Produkt', order => <a href={this.link('detail', { id: order.id })}>{order.product}</a>);

    this.grid.addAction('Detail', { href: order => this.link('detail', { id: order.id }), primary: true });
    this.grid.addAction('Smazat', { onClick: order => this.api.call('order.delete', { id: order.id }), danger: true, confirm: 'Smazat?' });
    this.grid.addBulkAction('Smazat vybrané', ids => this.api.call('order.deleteMany', { ids }), { confirm: 'Smazat vybrané?' });

    this.grid.bind(this);   // stav v URL
  }

  render() {
    return <GridView grid={this.grid} search resizable reorderable columnToggle aria-label="Objednávky" />;
  }
}
```

Celá ukázka je v `examples/grid` (`npm run dev`, stránka `/grid`).

### Data

- **Ze serveru:** `load(query)` dostane dotaz ve formátu [phloxcz/api-query](https://github.com/phloxcz/api-query) (stejný jako Kendo UI) a vrátí `{ data, total }`. Odpověď phlox-api-query jde do gridu rovnou, bez převodu:

  ```json
  { "page": 2, "pageSize": 20, "sort": [{ "field": "price", "dir": "desc" }], "search": "fénix",
    "filter": { "logic": "and", "filters": [{ "field": "category", "operator": "in", "value": ["Knihy", "Sport"] },
                                            { "field": "price", "operator": "gte", "value": 100 }] },
    "aggregate": [{ "field": "price", "aggregate": "sum" }] }
  ```

- **V prohlížeči:** `rows: orders` (pole, nebo funkce, která ho vrátí). Grid hledá, filtruje, řadí, sčítá a stránkuje sám, stejnými pravidly. Tytéž pravidla nabízí `applyQuery(rows, query, searchIn)`, třeba pro testovací server.
- **Starší odpověď nikdy nepřepíše novější.** Stránka za koncem (třeba po smazání posledních řádků) přejde na poslední.
- **`grid.load()`** načte znovu, třeba po změně dat jinde. Akce na řádku a hromadné akce načítají samy.
- **Klíč řádku** je pole `id`, jiné nastaví volba `key`.

### Sloupce

| Metoda | Sloupec |
|---|---|
| `addTextColumn(key, label)` | text |
| `addNumberColumn(key, label)` | číslo, zarovnané doprava, s oddělením tisíců |
| `addDateColumn(key, label)` | datum `RRRR-MM-DD` nebo datum a čas ISO 8601, jak je posílá API |
| `addBoolColumn(key, label)` | ano a ne jako ✓ a – |
| `addColumn(key, label, row => …)` | vlastní obsah buňky, jakákoli šablona |

Názvy sloupců hlídá kompilátor podle typu řádku. Nastavení se řetězí:

- **`.sortable()`:** klik na záhlaví řadí vzestupně, sestupně a pak vůbec, jako v PHP. Záhlaví má `aria-sort`.
- **`.filterable()`:** filtr podle druhu sloupce. Text hledá podřetězec (`contains`), číslo a datum mají rozsah od–do (`gte`, `lte`), ano a ne výběr. **`.filterSelect(items)`** pevné možnosti (`eq`), **`.filterSelect(items, true)`** několik naráz (`in`). **`.filterDropDown({ search, label })`** možnosti ze serveru přes DropDownList s hledáním.
- **`.searchable()`:** sloupec prohledává pole hledání nad tabulkou, když jsou data v prohlížeči. Na serveru o tom rozhoduje API.
- **`.format(value => text)`** text hodnoty, třeba měna. **`.render(row => …)`** celý obsah buňky. **`.align('end')`**, **`.width('12rem')`**, **`.class('…')`**.
- **`.aggregate('sum' | 'avg' | 'count' | 'min' | 'max')`:** součet v patičce, ze všech vyfiltrovaných řádků, ne jen ze stránky. Grid o něj žádá v dotazu (`aggregate`) a čeká ho v odpovědi (`aggregates: { price: { sum: 1500 } }`) jako Kendo. phlox-api-query součty zatím nepočítá, u dat v prohlížeči je spočítá grid.
- **`.alwaysVisible()`:** sloupec nejde skrýt.

### Stav v URL

**`grid.bind(this)`** v presenteru dá stránku, řazení, hledání a filtry do URL: `?page=2&sort=-price&q=fénix&f.category=Knihy,Sport&f.price=100..300`. Odkaz jde poslat a ukáže totéž, tlačítka Zpět a Vpřed vracejí předchozí stav, obnovení stránky ho drží. Parametry se stanou persistentními, takže odkaz na detail (routovaný dialog) je nese dál a po zavření dialogu je seznam stejný.

- **Grid musí patřit presenteru, který obsluhuje konec URL** (jeho routa nemá `presenter`). Jen ten dostává query parametry.
- **Dva gridy na stránce** potřebují předponu: `bind(this, 'items-')`.
- **Počet řádků na stránku** je v URL taky (`size`), výchozí hodnota se nepíše.
- **Bez `bind`** drží grid stav sám u sebe.

### Šířka, pořadí a viditelnost sloupců

S `remember: 'klíč'` si je grid pamatuje v prohlížeči (`localStorage`), patří k uživateli, ne do odkazu.

- **`resizable`:** šířka tažením za pravý okraj záhlaví. Po první změně dostanou šířku všechny sloupce a tabulka je široká jako jejich součet, takže sloupec roste přesně podle tahu a tabulka se případně posouvá do strany.
- **`reorderable`:** přesun tažením záhlaví, místo ukáže čára. Krátké kliknutí dál řadí.
- **`columnToggle`:** menu Sloupce se zaškrtávátky pro skrytí a s tlačítky ← → pro přesun z klávesnice.
- **Z kódu:** `grid.toggleColumn(key, show)`, `grid.moveColumn(key, before)`, `grid.shiftColumn(key, -1)`, `grid.setWidth(key, '200px')`, `grid.resetColumns()`.

### Akce

- **`addAction(label, { href | onClick, primary, danger, confirm, visible })`:** `primary` je tlačítko v řádku, ostatní jsou v menu ⋮. `href` dělá odkaz, `onClick` funkci, po které se grid načte znovu. `visible: row => …` ukáže akci jen u některých řádků.
- **`addBulkAction(label, (keys, rows) => …, { confirm, danger })`:** řádky dostanou zaškrtávátka, nad tabulkou se objeví lišta s počtem vybraných. Výběr platí napříč stránkami (podle klíčů), po akci se smaže a grid se načte znovu.
- **`confirm`** se ptá popoverem u tlačítka akce (`app.confirm` s `anchor`), u akce s `danger` s varovným OK. Jinou otázku nastaví `Grid.confirm = (question, anchor, danger) => …`, mimo běžící aplikaci se grid ptá přes `window.confirm`.

### Ostatní

- **`<GridView>`:** `search` (pole hledání), `resizable`, `reorderable`, `columnToggle`, `aria-label`, `class`.
- **Hledání a textové filtry** čekají 0,4 s po posledním stisku, Enter hned. Tlačítko Zrušit filtry smaže hledání i filtry.
- **Panely filtrů a menu** jsou umístěné `fixed`, takže je posuvná tabulka neořízne. Zavře je Escape (ne dialog kolem), klik mimo nebo odchod fokusu.
- **Během načítání** tabulka zesvětlí a má `aria-busy`, počet záznamů je v `role="status"`.
- **Texty** jsou anglicky, přelož je jednou při startu: `Grid.texts = { ...Grid.texts, search: 'Hledat…', … }`. **Vzhled** dodává téma, místa `grid.table`, `grid.th`, `grid.td`, `grid.pageLink`… (výchozí téma a Bootstrap podle PHP knihovny).

## Testování aplikací

Pomocníci pro testy aplikací jsou v `phlox-js/testing`, mock serveru RPC v `phlox-js/net`. Fungují s každým nástrojem, který má DOM, typicky Vitest s jsdom.

```ts
import { afterEach, expect, test } from 'vitest';
import { bootApp, cleanup, until } from 'phlox-js/testing';
import { createRpcMock } from 'phlox-js/net';

afterEach(cleanup);

test('detail úkolu', async () => {
  const server = createRpcMock<RpcMethods>({
    'task.read': ({ id }) => ({ id, name: 'Opravit export' }),
  });
  const { element, errors, go } = await bootApp(AppPresenter, { url: '/tasks', services: createServices({ fetch: server.fetch }) });
  await go('/tasks/5');
  await until(() => element.querySelector('h1')?.textContent === 'Opravit export');
  expect(server.calls).toEqual([{ method: 'task.read', params: { id: 5 } }]);
  expect(errors).toEqual([]);
});
```

- **`bootApp(root, { url, services, basePath })`** spustí aplikaci se skutečnými presentery. Vrátí `app`, `element`, `go(url)` a `errors`, kam místo konzole jdou chyby aplikace. **`cleanup()`** všechny zastaví a vyprázdní stránku, patří do `afterEach`.
- **`until(podmínka)`** počká, až se třeba ukážou data. **`tick()`** nechá proběhnout časovače a události, **`type(pole, text)`** a **`press(prvek, 'Enter')`** píšou a mačkají jako uživatel.
- **Služby jako funkce:** `createServices(options)` místo hotového kontejneru, aby test dostal stejné služby jako aplikace, jen s jiným `fetch` (nebo s falešnou službou místo skutečné). Viz `examples/helpdesk/services.ts`.
- **`createRpcMock<RpcMethods>(metody, { context, latency })`** odpovídá jako `phlox-rpc-api`: dávky, chyby, notifikace. Chybu pošle `throw new RpcMockError(kód, zpráva, fields)`, `-32602` s `fields` ukáže formulář u polí. `context` z hlaviček udělá třeba přihlášeného uživatele. `fetch` je pro `RpcClient`, `handle(body, headers)` pro server, třeba plugin Vite.
- **Jedna tabulka metod pro vývoj i testy:** helpdesk má mock server ve Vite i v testu (`tests/helpdesk.test.tsx`) z jedné `helpdeskMock()`.

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
- **SVG** funguje přímo v šabloně: `<svg viewBox="0 0 24 24"><path d="M5 12h14" stroke-width="2" /></svg>`. Prvky uvnitř `<svg>` jsou SVG, obsah `<foreignObject>` zase HTML. Atributy s pomlčkou (`stroke-width`, `aria-hidden`) kompilátor nekontroluje.

### Události

Události jsou `on` + název s velkým písmenem. `event.currentTarget` má typ podle prvku.

```tsx
<input value={draft} onInput={event => draft.set(event.currentTarget.value)} />
<form onSubmit={save} />
```

**Chyby obsluh** jdou do `app.onError`, vyhozené i z promise, který obsluha vrátí. `onClick={() => this.handleSave()}` tak chybu serveru neztratí, ukáže se jako každá jiná chyba aplikace. Mimo běžící aplikaci (`render()`) se obsluha volá beze změny.

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
