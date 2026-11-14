import { Presenter, RouteFrame } from '@phloxcz/phlox-js';
import type { Route } from '@phloxcz/phlox-js';

class HomePresenter extends Presenter {
  render() {
    return <p>Úvod je v hlavním balíku, ukáže se hned.</p>;
  }
}

/** A class is in the main bundle, a function with import() is downloaded on the first visit of its route. */
export default class AppPresenter extends Presenter {
  override routes: Route[] = [
    { name: 'reports', pattern: '/reports', presenter: () => import('./_lazy-reports') },
    { name: 'home', pattern: '', presenter: HomePresenter },
  ];

  render() {
    return (
      <div>
        <nav>
          <a href={this.link('home')}>Úvod</a>
          <a href={this.link('reports')}>Reporty (líně)</a>
        </nav>
        <RouteFrame />
      </div>
    );
  }
}
