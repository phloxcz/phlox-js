import { Else, For, If, Presenter, ResizeHandle, RouteFrame, computed, route, state } from '@phloxcz/phlox-js';
import type { Route } from '@phloxcz/phlox-js';
import { foldText } from '@phloxcz/phlox-js/forms';
import { Icon } from '../components/Icon';
import { ProjectEdit } from '../components/ProjectEdit';
import { Store } from '../model/Store';
import { OfflineWork } from '../model/offline';
import { TasksPresenter } from './TasksPresenter';

/** The column of projects at /projects; the tasks of the chosen one are at /projects/<id>. */
export class ProjectsPresenter extends Presenter {
  /** A typed route: `project` is a number in props, link(this.project, …) is checked by the compiler. */
  public readonly project = route('project', '/<project:int>', { presenter: TasksPresenter, props: ({ project }) => ({ projectId: project }) });

  public override routes: Route[] = [
    { name: 'default', pattern: '/' },
    this.project,
  ];

  public readonly filter = state('');
  /** The width of the column, set by the user and remembered in the browser. */
  public readonly width = this.preference('helpdesk.projects.width', 236);
  public readonly shown = computed(() => {
    const words = foldText(this.filter().trim());
    return this.store.projects().filter(project => foldText(project.name).includes(words));
  });

  public constructor(private store: Store, private work: OfflineWork) {
    super();
  }

  public override pageTitle() {
    return 'Projekty';
  }

  /** Without a chosen project the first one opens. */
  public actionDefault() {
    const first = this.store.projects()[0];
    if (first) return this.redirect(this.project, { project: first.id });
  }

  public async handleCreate(): Promise<void> {
    // A form as a panel sliding in from the right, like offcanvas
    const project = await this.openDialog(ProjectEdit, {}, { placement: 'end' });
    if (!project) return;
    this.app.invalidate('projects');
    this.flashMessage(`Projekt ${project.name} je založený.`, 'success');
    void this.app.router.navigate(this.link(this.project, { project: project.id }));
  }

  public render() {
    const current = () => Number(this.params().project);
    return (
      <>
        <section class="hd-column hd-projects" aria-labelledby="hd-projects-title" style={() => `--hd-projects-width: ${this.width()}px`}>
          <div class="hd-column-head">
            <h2 id="hd-projects-title">Projekty</h2>
            <button type="button" class="hd-round-button" title="Nový projekt" aria-label="Nový projekt" onClick={() => this.handleCreate()}>
              <Icon name="plus" size={20} />
            </button>
          </div>
          <div class="hd-filter">
            <Icon name="search" size={17} />
            <input type="search" class="form-control" placeholder="Hledat projekt…" aria-label="Hledat projekt" value={this.filter}
              onInput={event => this.filter.set(event.currentTarget.value)} />
          </div>
          <If when={() => this.shown().length > 0}>
            <ul class="hd-project-list">
              <For each={this.shown} key={project => project.id}>
                {project => (
                  <li>
                    <a href={() => this.link(this.project, { project: project().id })} class="hd-project"
                      aria-current={() => (current() === project().id ? 'page' : null)}>
                      <span class="hd-project-dot" style={() => ({ color: project().color })} />
                      <span class="hd-project-text">
                        <strong>{() => project().name}</strong>
                        <small>{() => project().subtitle}</small>
                      </span>
                      <If when={() => this.work.prepared().includes(`project-${project().id}`)}>
                        <span class="hd-offline-ready" title="Připraveno pro offline"><Icon name="cloudCheck" size={15} /></span>
                      </If>
                      <span class="hd-count">{() => project().taskCount}</span>
                    </a>
                  </li>
                )}
              </For>
            </ul>
          <Else />
            <p class="hd-muted hd-pad">Žádný projekt neodpovídá.</p>
          </If>
          <ResizeHandle size={this.width} min={180} max={420} initial={236} label="Šířka seznamu projektů" />
        </section>
        <RouteFrame />
      </>
    );
  }
}
