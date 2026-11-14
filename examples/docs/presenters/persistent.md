# Persistentní parametry

Jako `#[Persistent]` v Nette: query parametry, které si odkazy presenteru nesou dál.

```ts
class OrdersPresenter extends Presenter {
  override persistent = ['page', 'sort', 'filter.*'];
}

// na /orders?page=3&sort=-price&tab=x
this.link('detail', { id: 5 })               // /orders/5?page=3&sort=-price
this.link('detail', { id: 5, page: null })   // /orders/5?sort=-price
```

<!-- demo: persistent-orders -->

- **Platí pro odkazy presenteru a presenterů pod ním** na jejich routy. `link('this')` nese celé query vždy, absolutní cesta (`link('/about')`) nic.
- **Název s `*` na konci** platí pro všechny, které tak začínají: `'filter.*'`.
- **Parametr předaný `link()` má přednost,** `null` ho vynechá.
- **Hodnoty jsou texty** z URL, převádí je ten, kdo je čte (akce, grid).
- **Zavření routovaného dialogu** po přímém odkazu vede na URL presenteru i s jeho persistentními parametry, takže seznam pod dialogem zůstane, jak byl.
