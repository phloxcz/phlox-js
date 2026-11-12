import { Dropdown, Else, For, If, Presenter, ResizeHandle, RouteFrame, computed } from 'phlox-js';
import type { Resource, Route } from 'phlox-js';
import { HelpdeskApi } from '../api';
import type { Priority, Status, TaskPage, TaskResource } from '../api';
import { Icon } from '../components/Icon';
import { Avatar, PriorityBadge } from '../components/ui';
import { PRIORITY, dueLabel, isUrgent } from '../format';
import { Store } from '../model/Store';
import { TaskDetailPresenter } from './TaskDetailPresenter';

interface Props {
  /** Tasks of a project; without it all tasks. */
  projectId?: number;
  /** Only tasks of the logged-in user. */
  mine?: boolean;
}

const TABS: [Status | null, string, keyof TaskPage['counts']][] = [
  [null, 'Vše', 'all'], ['open', 'Otevřené', 'open'], ['progress', 'V řešení', 'progress'], ['closed', 'Uzavřené', 'closed'],
];
const PRIORITIES: Priority[] = ['high', 'medium', 'low'];

/**
 * The list of tasks: of a project at /projects/<id>, mine at /my, all at /all; the detail is at …/<task>.
 * The tab, the order and the filter are persistent parameters, so they stay in the URL when a task opens.
 */
export class TasksPresenter extends Presenter<Props> {
  override persistent = ['status', 'sort', 'priority'];
  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'detail', pattern: '/<task \\d+>', presenter: TaskDetailPresenter, props: ({ task }) => ({ taskId: Number(task) }) },
  ];

  readonly status = computed(() => (this.params().status ?? null) as Status | null);
  readonly sort = computed(() => (this.params().sort === 'priority' ? 'priority' : 'due'));
  /** As text, so that a click on a task (another parameter) does not load the list again. */
  readonly priority = computed(() => this.params().priority ?? '');
  /** The width of the list, set by the user and remembered in the browser. */
  readonly width = this.preference('helpdesk.tasks.width', 416);
  tasks!: Resource<TaskPage>;

  constructor(private api: HelpdeskApi, private store: Store) {
    super();
  }

  override async startup() {
    // Here the parameters are known; the list loads again when a parameter or the data change
    this.tasks = this.resource(() => {
      this.store.version();
      const priority = this.priority().split(',').filter(Boolean) as Priority[];
      return this.api.call('task.list', {
        query: {
          ...(this.props.projectId ? { projectId: this.props.projectId } : {}),
          ...(this.props.mine ? { assigneeId: Number(this.user.getId()) } : {}),
          ...(this.status() ? { status: this.status()! } : {}),
          ...(priority.length ? { priority } : {}),
          sort: this.sort(),
        },
      });
    });
    await this.tasks.ready();
  }

  heading(): string {
    if (this.props.mine) return 'Moje úkoly';
    if (!this.props.projectId) return 'Všechny úkoly';
    return `Úkoly – ${this.store.project(this.props.projectId)?.name ?? ''}`;
  }

  /** The checkbox closes a task, or opens it again. */
  async handleDone(task: TaskResource, done: boolean): Promise<void> {
    await this.api.call('task.update', {
      id: task.id,
      input: { status: done ? 'closed' : 'open', priority: task.priority, assigneeId: task.assigneeId, due: task.due },
    });
    await this.store.changed();
  }

  private togglePriority(priority: Priority, on: boolean): string | null {
    const chosen = new Set(this.priority().split(',').filter(Boolean));
    if (on) chosen.add(priority);
    else chosen.delete(priority);
    return chosen.size ? PRIORITIES.filter(item => chosen.has(item)).join(',') : null;
  }

  render() {
    const current = () => Number(this.params().task);
    return (
      <>
        <section class="hd-column hd-tasks" aria-labelledby="hd-tasks-title" style={() => `--hd-tasks-width: ${this.width()}px`}>
          <div class="hd-column-head">
            <h2 id="hd-tasks-title">{() => this.heading()}</h2>
            <a href={() => this.link('this', { sort: this.sort() === 'due' ? 'priority' : null })} class="hd-icon-button"
              title={() => (this.sort() === 'due' ? 'Řazeno podle termínu, řadit podle priority' : 'Řazeno podle priority, řadit podle termínu')}>
              <Icon name="sort" size={19} />
            </a>
            <Dropdown class={() => `hd-icon-button hd-filter-button ${this.priority() ? 'hd-active' : ''}`} panelClass="hd-menu"
              placement="bottom-right" title="Filtr" label={<Icon name="filter" size={18} />}>
              <div class="hd-menu-head"><strong>Priorita</strong></div>
              <For each={() => PRIORITIES}>
                {priority => (
                  <label class="hd-menu-item">
                    <input type="checkbox" checked={() => this.priority().split(',').includes(priority)}
                      onChange={event => void this.app.router.navigate(this.link('this', { priority: this.togglePriority(priority, event.currentTarget.checked) }))} />
                    <PriorityBadge priority={priority} />
                  </label>
                )}
              </For>
            </Dropdown>
          </div>
          <nav class="hd-tabs" aria-label="Stav úkolů">
            <For each={() => TABS}>
              {([status, text, count]) => (
                <a href={() => this.link('this', { status })} aria-current={() => (this.status() === status ? 'page' : null)}>
                  {text} ({() => this.tasks()?.counts[count] ?? 0})
                </a>
              )}
            </For>
          </nav>
          <If when={() => (this.tasks()?.data.length ?? 0) > 0}>
            <ul class={() => `hd-task-list ${this.tasks.loading() ? 'hd-loading' : ''}`}>
              <For each={() => this.tasks()!.data} key={task => task.id}>
                {task => (
                  <li class={() => `hd-task ${current() === task().id ? 'hd-selected' : ''} ${task().status === 'closed' ? 'hd-done' : ''}`}>
                    <input type="checkbox" checked={() => task().status === 'closed'} aria-label={() => `Hotovo: ${task().title}`}
                      onChange={event => void this.handleDone(task(), event.currentTarget.checked)} />
                    <a href={() => this.link('detail', { task: task().id })} class="hd-task-title"
                      aria-current={() => (current() === task().id ? 'page' : null)}>{() => task().title}</a>
                    <span class="hd-task-meta">
                      {() => <PriorityBadge priority={task().priority} />}
                      {() => <Avatar user={this.store.user(task().assigneeId)} size="small" />}
                      <span class={() => `hd-due ${isUrgent(task().due, task().status) ? 'hd-urgent' : ''}`}>{() => dueLabel(task().due)}</span>
                    </span>
                  </li>
                )}
              </For>
            </ul>
          <Else />
            <p class="hd-muted hd-pad">{() => (this.priority()
              ? `Žádné úkoly s prioritou ${this.priority().split(',').map(item => PRIORITY[item as Priority]?.toLowerCase()).join(', ')}.`
              : 'Žádné úkoly.')}</p>
          </If>
          <ResizeHandle size={this.width} min={300} max={760} initial={416} label="Šířka seznamu úkolů" />
        </section>
        <If when={() => this.route() === 'default'}>
          <section class="hd-column hd-detail hd-empty">
            <Icon name="squareCheck" size={40} />
            <p>Vyberte úkol ze seznamu.</p>
          </section>
        </If>
        <RouteFrame />
      </>
    );
  }
}
