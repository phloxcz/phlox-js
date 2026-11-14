# Načítaná data

Seznam, který závisí na stavu (záložka, filtr, vybraný projekt), si řekne o data funkcí. Načte se znovu, kdykoli se změní stav přečtený v ní:

```tsx
import type { Resource } from '@phloxcz/phlox-js';

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

<!-- demo: resource-filter -->

- **`tasks()`** je poslední načtená hodnota, `undefined` před prvním načtením. Během dalšího načítání zůstává, `tasks.loading()` je mezitím `true`.
- **Sleduje se stav přečtený před prvním `await`** ve funkci. V `async` funkci tedy čti stav na začátku.
- **Starší odpověď nepřepíše novější,** i když přijde později.
- **Chyba** jde do `app.onError`, hodnota zůstane poslední dobrá.
- **`tasks.reload()`** načte znovu se stejným stavem, `tasks.ready()` počká na běžící načtení.
- **Vytvoř ho v konstruktoru nebo ve `startup()`.** V inicializátoru pole ještě nejsou služby z konstruktoru. U presenteru, který čte své parametry, ve `startup()`, ten je už zná.
- **Skončí s komponentou,** po jejím odstranění se nic nenačítá.

## Data sdílená obrazovkami: štítky a `invalidate`

Po uložení se mají obnovit i jiné části obrazovky: seznam, počty v záložkách, číslo v menu. Zdroj proto řekne, jaká data ukazuje, a po změně stačí ta data zneplatnit:

```ts
// seznam úkolů
this.tasks = this.resource(() => this.api.call('task.list', { … }), { tags: ['tasks'] });

// detail po uložení: načte se znovu všechno se štítkem 'tasks', na kterékoli obrazovce
await this.api.call('task.update', { id, input });
this.app.invalidate('tasks');
```

<!-- demo: resource-tags -->

- **Štítky** jsou libovolné texty, obvykle podle druhu dat: `'tasks'`, `'projects'`, `'users'`. Zdroj jich může mít víc.
- **`invalidate()`** jich přijme víc najednou: `this.app.invalidate('tasks', 'projects')`. Zdroje, které se tím spustí, se volají v jednom okamžiku, takže jdou na server jednou dávkou.
- **Data celé aplikace** (uživatelé, číselníky), která drží služba, ne komponenta: `app.resource(load, { tags })`. Žije, dokud aplikace běží. Služba si `Application` řekne v konstruktoru jako každou jinou službu.
- **Po přihlášení jiného uživatele** zneplatni data, která drží služby: `this.app.invalidate('users', 'projects', 'tasks')`.
