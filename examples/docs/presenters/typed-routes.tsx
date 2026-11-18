import { For, Presenter, RouteFrame, route } from '@phloxcz/phlox-js';
import type { Route } from '@phloxcz/phlox-js';

class TaskPresenter extends Presenter<{ taskId: number }> {
  public render() {
    // taskId is a number already, <task:int> in the pattern
    return <p>Úkol číslo <strong>{this.props.taskId}</strong>, typ: {typeof this.props.taskId}</p>;
  }
}

/** route(): the types of parameters come from the pattern, link() with a missing or wrong one does not compile. */
export default class TasksPresenter extends Presenter {
  public readonly detail = route('detail', '/<task:int>', { presenter: TaskPresenter, props: ({ task }) => ({ taskId: task }) });

  public override routes: Route[] = [{ name: 'default', pattern: '/' }, this.detail];

  public render() {
    return (
      <div>
        <nav>
          <For each={() => [3, 7, 12]}>
            {task => <a href={this.link(this.detail, { task })}>Úkol {task}</a>}
          </For>
        </nav>
        {/* this.link(this.detail, { task: 'x' }) or this.link(this.detail, {}) is an error of the compiler */}
        <RouteFrame />
      </div>
    );
  }
}
