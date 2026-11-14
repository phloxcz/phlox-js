import { Button, Component, For, state } from '@phloxcz/phlox-js';

interface Task { id: number; name: string; done: boolean }

let version = 0;
/** Like a server: every answer has new objects. */
const load = (): Task[] => {
  version++;
  return [
    { id: 1, name: `Faktura (verze ${version})`, done: version % 2 === 0 },
    { id: 2, name: `Smlouva (verze ${version})`, done: false },
    { id: 3, name: `Objednávka (verze ${version})`, done: version % 3 === 0 },
  ];
};

/** With key: rows with the same id stay when new objects come, so does text typed into them. */
export default class Keyed extends Component {
  readonly tasks = state<Task[]>(load());

  render() {
    return (
      <div>
        <Button onClick={() => this.tasks.set(load())}>Načíst znovu</Button>
        <ul>
          <For each={this.tasks} key={task => task.id}>
            {task => (
              <li>
                <input type="checkbox" checked={() => task().done} disabled />{' '}
                {() => task().name}{' '}
                <input placeholder="poznámka zůstane" size={16} />
              </li>
            )}
          </For>
        </ul>
      </div>
    );
  }
}
