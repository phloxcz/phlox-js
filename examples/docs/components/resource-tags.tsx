import { Button, Component, For, state } from 'phlox-js';
import type { Container, Resource } from 'phlox-js';

interface Task { id: number; title: string; done: boolean }

/** A stand-in for the server, with data that change. */
class TaskApi {
  private tasks: Task[] = [
    { id: 1, title: 'Opravit přihlášení', done: false },
    { id: 2, title: 'Export do PDF', done: true },
    { id: 3, title: 'Nový přehled', done: false },
  ];

  async list(): Promise<Task[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return this.tasks.map(task => ({ ...task }));
  }

  async toggle(id: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
    this.tasks = this.tasks.map(task => (task.id === id ? { ...task, done: !task.done } : task));
  }
}

export function services(container: Container) {
  container.add(TaskApi);
}

/** One screen: the list changes the data and calls app.invalidate('tasks'). */
class TaskList extends Component {
  tasks!: Resource<Task[]>;

  constructor(private api: TaskApi) {
    super();
  }

  override startup() {
    this.tasks = this.resource(() => this.api.list(), { tags: ['tasks'] });
  }

  async handleToggle(task: Task) {
    await this.api.toggle(task.id);
    this.app.invalidate('tasks');
  }

  render() {
    return (
      <ul>
        <For each={() => this.tasks() ?? []} key={task => task.id}>
          {task => (
            <li>
              <label>
                <input type="checkbox" checked={() => task().done} onChange={() => this.handleToggle(task())} /> {() => task().title}
              </label>
            </li>
          )}
        </For>
      </ul>
    );
  }
}

/** Another place on the screen, it knows nothing about the list: its resource has the same tag. */
class OpenCount extends Component {
  readonly reloads = state(0);
  tasks!: Resource<Task[]>;

  constructor(private api: TaskApi) {
    super();
  }

  override startup() {
    this.tasks = this.resource(() => {
      this.reloads.update(n => n + 1);
      return this.api.list();
    }, { tags: ['tasks'] });
  }

  render() {
    return <p>Otevřených: <strong>{() => this.tasks()?.filter(task => !task.done).length ?? '…'}</strong> <small>(načteno {this.reloads}×)</small></p>;
  }
}

export default class SharedData extends Component {
  render() {
    return (
      <div>
        <OpenCount />
        <TaskList />
        <Button small onClick={() => this.app.invalidate('tasks')}>app.invalidate('tasks')</Button>
      </div>
    );
  }
}
