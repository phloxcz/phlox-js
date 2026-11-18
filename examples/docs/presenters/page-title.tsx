import { For, Presenter, RouteFrame, state } from '@phloxcz/phlox-js';
import type { Route } from '@phloxcz/phlox-js';

const PROJECTS = ['Apollo', 'Gemini', 'Mercury'];

class ProjectPresenter extends Presenter<{ index: number }> {
  public readonly name = state(PROJECTS[this.props.index] ?? '');

  // Like {block title} in Nette; it can read state, the title follows it
  public override pageTitle() {
    return this.name();
  }

  public override async startup() {
    // Navigation waits for startup(): the old screen stays until the new one is ready
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  public render() {
    return (
      <div>
        <h2>{this.name}</h2>
        <input value={this.name} onInput={event => this.name.set(event.currentTarget.value)} />
        <p><small>Přepište název: titulek nahoře se mění s ním.</small></p>
      </div>
    );
  }
}

/** The title is given by the deepest presenter that has one. */
export default class ProjectsPresenter extends Presenter {
  public override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'detail', pattern: '/<index:int>', presenter: ProjectPresenter, props: ({ index }) => ({ index: Number(index) }) },
  ];

  public override pageTitle() {
    return 'Projekty';
  }

  public render() {
    return (
      <div>
        <nav>
          <For each={() => PROJECTS}>{(name, index) => <a href={this.link('detail', { index: index() })}>{name}</a>}</For>
        </nav>
        <RouteFrame />
      </div>
    );
  }
}
