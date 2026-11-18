import { Button, Component, For, computed, state } from '@phloxcz/phlox-js';
import type { State } from '@phloxcz/phlox-js';

interface Item { name: string; done: State<boolean> }

/** Without key: rows belong to the objects, what changes in a row is a state inside the item. */
export default class Items extends Component {
  public readonly draft = state('');
  public readonly items = state<Item[]>([
    { name: 'Mléko', done: state(false) },
    { name: 'Chléb', done: state(true) },
  ]);
  public readonly remaining = computed(() => this.items().filter(item => !item.done()).length);

  public add() {
    const name = this.draft().trim();
    if (!name) return;
    this.items.update(items => [...items, { name, done: state(false) }]);
    this.draft.set('');
  }

  public render() {
    return (
      <div>
        <form onSubmit={event => { event.preventDefault(); this.add(); }}>
          <input value={this.draft} placeholder="Položka" onInput={event => this.draft.set(event.currentTarget.value)} />{' '}
          <Button type="submit">Přidat</Button>
        </form>
        <ul>
          <For each={this.items}>
            {(item, index) => (
              <li style={() => ({ textDecoration: item.done() ? 'line-through' : 'none' })}>
                {() => index() + 1}.{' '}
                <input type="checkbox" checked={item.done} onChange={event => item.done.set(event.currentTarget.checked)} />{' '}
                {item.name}{' '}
                <Button small onClick={() => this.items.update(items => items.filter(other => other !== item))}>Smazat</Button>
              </li>
            )}
          </For>
        </ul>
        <p>Zbývá: {this.remaining}</p>
      </div>
    );
  }
}
