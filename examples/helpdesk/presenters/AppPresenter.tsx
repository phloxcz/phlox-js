import { Presenter, RouteFrame } from 'phlox-js';
import type { Route } from 'phlox-js';
import { SignPresenter } from './SignPresenter';
import { WorkspacePresenter } from './WorkspacePresenter';

/** The root: the sign-in page, or the workspace with everything else. */
export class AppPresenter extends Presenter {
  override routes: Route[] = [
    { name: 'sign', pattern: '/sign', presenter: SignPresenter },
    // An empty pattern takes nothing from the URL, the workspace handles all the rest
    { name: 'workspace', pattern: '', presenter: WorkspacePresenter },
  ];

  render() {
    return <RouteFrame />;
  }
}
