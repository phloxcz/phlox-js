# Komponenty

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

<!-- demo: component-card -->

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
- **Vyhrazená jména:** komponenta už má tato pole a metody, vlastní pole se stejným jménem je chyba kompilace: `props`, `parent`, `app`, `scope`, `presenter`, `user`, `link`, `startup`, `render`, `afterRender`, `shutdown`, `title`, `actions`, `close`, `cancel`, `onClose`, `hasUnsavedChanges`, `resource`, `preference`, `openDialog`, `flashMessage`, `alert`, `confirm`, `prompt`, `showLoading`. Presenter navíc `routes`, `persistent`, `route`, `params`, `child`, `basePath`, `redirect`, `error`, `notFound`, `pageTitle`. Na stav načítání se tedy hodí třeba `saving` nebo `busy`, na zobrazeného uživatele `detail` nebo `author`.
- **`effect()` a `computed()` v inicializátoru pole, konstruktoru nebo `startup()`** patří komponentě a skončí s ní. Ve `startup()` jen ty vytvořené před prvním `await`, za ním už JS neví, čí kód běží.
