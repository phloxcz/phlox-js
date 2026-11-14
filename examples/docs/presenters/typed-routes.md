# Typované routy

```ts
import { route } from '@phloxcz/phlox-js';

class TasksPresenter extends Presenter {
  readonly detail = route('detail', '/<task:int>', { presenter: TaskDetailPresenter, props: ({ task }) => ({ taskId: task }) });

  override routes: Route[] = [{ name: 'default', pattern: '/' }, this.detail];

  render() {
    return <a href={this.link(this.detail, { task: 5 })}>Úkol 5</a>;   // task chybí nebo je text: chyba kompilace
  }
}
```

<!-- demo: typed-routes -->

- **Typy parametrů** se čtou ze vzoru: `<task:int>` je v `props` a `dialog` číslo, `<slug>` text. `Number(…)` odpadá.
- **`link(this.detail, { task })`** a `redirect(this.detail, { task })` kompilátor hlídá: chybějící parametr i špatný typ je chyba. Další parametry jdou do query jako u `link('detail', …)`.
- **I za běhu:** `link()` s textem místo čísla u `:int` vyhodí chybu hned, ne až nefunkční odkaz.
- **`this.params()` a akce** dostávají parametry dál jako texty z URL, spolu s query. Převedené jsou jen v `props` a `dialog` routy.
- **Obyčejné routy** (`{ name, pattern }`) fungují dál, `<id:int>` v nich převede hodnotu pro `props` a `dialog` stejně, jen bez typové kontroly odkazů.
