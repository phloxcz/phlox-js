# Navigace a titulek stránky

- **Stará obrazovka zůstává, dokud nová není připravená.** Nové presentery se vytvoří stranou, proběhne jejich `startup()` a akce, a teprve pak se obrazovka vymění.
- **Když cokoli selže, nezmění se nic** a chybu dostane `app.onError`.
- **Běží jen jedna navigace.** Když uživatel klikne jinam dřív, než doběhne, vyhrává poslední kliknutí.

## Titulek stránky a čtečky

```ts
class TaskDetailPresenter extends Presenter {
  public override pageTitle() {
    return this.task()?.title ?? null;   // jako {block title} v Nette, může číst state
  }
}
```

<!-- demo: page-title -->

- **`document.title`** dá nejhlubší presenter, který titulek má. Na `/projects/1/5` tedy úkol, ne seznam. Mění se se stavem, který `pageTitle()` čte.
- **Složení** dělá `app.formatTitle`: ve výchozím stavu „Úkol – <titulek z index.html>“, bez titulku stránky jen titulek z `index.html`. Jinak: `app.formatTitle = page => page ? `${page} | Obchod` : 'Obchod'`.
- **Čtečky** se po přechodu na jinou stránku dozví její titulek (skrytá oblast `aria-live`). Změna jen query (záložka, filtr) se neohlašuje.
- **Fokus** po navigaci zůstává, kde byl, aby seznam s detailem neztratil místo. Když ale prvek s fokusem zmizel se starou stránkou, přejde fokus na první `<h1>` nové stránky.
