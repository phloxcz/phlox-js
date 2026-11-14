import { Component, For, If, state } from 'phlox-js';
import type { Container, Resource } from 'phlox-js';

interface Task { id: number; title: string; status: 'open' | 'closed' }

const TASKS: Task[] = [
  { id: 1, title: 'Opravit přihlášení', status: 'open' },
  { id: 2, title: 'Export do PDF', status: 'closed' },
  { id: 3, title: 'Nový přehled', status: 'open' },
  { id: 4, title: 'Zálohy databáze', status: 'closed' },
];

/** A stand-in for the server: filters, and answers after a while. */
class TaskApi {
  async list(status: string | null): Promise<Task[]> {
    await new Promise(resolve => setTimeout(resolve, 400));
    return TASKS.filter(task => !status || task.status === status);
  }
}

export function services(container: Container) {
  container.add(TaskApi);
}

/** A resource loads again whenever the state read in it changes; the last value stays while it loads. */
export default class FilteredTasks extends Component {
  readonly status = state<string | null>(null);
  tasks!: Resource<Task[]>;

  constructor(private api: TaskApi) {
    super();
  }

  override startup() {
    this.tasks = this.resource(() => this.api.list(this.status()));
  }

  render() {
    return (
      <div>
        <select onChange={event => this.status.set(event.currentTarget.value || null)}>
          <option value="">Všechny</option>
          <option value="open">Otevřené</option>
          <option value="closed">Uzavřené</option>
        </select>{' '}
        <If when={() => this.tasks.loading()}><small>načítám…</small></If>
        <ul style={() => ({ opacity: this.tasks.loading() ? 0.5 : 1 })}>
          <For each={() => this.tasks() ?? []} key={task => task.id}>
            {task => <li>{() => task().title}</li>}
          </For>
        </ul>
      </div>
    );
  }
}
