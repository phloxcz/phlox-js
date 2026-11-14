# Presentery a routy

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

Totéž jako běžící ukázka: lišta nahoře ukazuje adresu uvnitř ukázky.

<!-- demo: presenters-nested -->

URL `/users/15/orders` se rozdělí takto: `AppPresenter` vezme `/users`, `UsersPresenter` vezme `/15` a `UserDetailPresenter` dostane `/orders`.

## Routy

- **`name`** určuje akci: routa `detail` volá `actionDetail(params)`. Akce je nepovinná.
- **`pattern`** je díl URL. Parametr se píše `<id>` (jeden díl cesty), `<id:int>` (celé číslo) nebo s regulárním výrazem `<id \d+>`. Ve výrazu se v řetězci lomítko zdvojuje (`'/<id \\d+>'`); vzor s jedním (`<id d+>`) skončí chybou s radou, ne routou, která tiše nesedí. Routy se zkoušejí v pořadí, první vyhovující vyhrává.
- **`presenter`** je presenter pro `<RouteFrame />`, buď třída, nebo funkce s `import()` (viz Líné načítání presenterů).
- **`props`** udělá z parametrů routy props jejího presenteru: `{ pattern: '/<id \\d+>', presenter: TasksPresenter, props: ({ id }) => ({ projectId: Number(id) }) }`. Presenter se při změně parametrů vytvoří znovu, takže props se za jeho života nemění. Jeden presenter tak může sloužit víc routám: `{ pattern: '/my', presenter: TasksPresenter, props: () => ({ mine: true }) }`.
- **Routa s `presenter` bere začátek URL,** routa bez něj musí sedět na celý zbytek.
- **`/`** znamená „nic dalšího“. Prázdný vzor `''` nebere nic a všechno předá dál, hodí se pro layout.
- **Presenter bez rout** je jedna stránka a jeho akce je `actionDefault()`.
- **`routes` potřebuje typ `Route[]`,** jinak TypeScript neodvodí typy parametrů ve funkcích uvnitř.
