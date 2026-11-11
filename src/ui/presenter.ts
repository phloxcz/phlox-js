/** Presenter: a component that URL leads to. Presenters form a tree and split the URL among themselves. */

import { getScope, state } from '../reactive/reactive';
import type { Child } from './dom';
import { COMPONENT, Component, renderComponent } from './component';
import type { Class } from '../di/container';
import type { FlashOptions } from '../application/application';

export type Params = Record<string, string>;
export type LinkParams = Record<string, string | number | boolean | null | undefined>;

type AnyPresenter = Presenter<any, any>;
type PresenterClass = Class<AnyPresenter>;

export interface Route {
  /** Name of the route. Route `detail` calls the method `actionDetail(params)`. */
  name: string;
  /** Part of the URL, for example `/users/<id \d+>`. A parameter without a regular expression takes one segment. */
  pattern: string;
  /** Presenter shown in <RouteFrame />, it handles the rest of the URL. A function loads it lazily: `() => import('./X')`. */
  presenter?: PresenterClass | (() => Promise<PresenterClass | { default: PresenterClass }>);
  /** Component shown in a dialog while the route is active: returns its class and props. */
  dialog?: (params: Params) => [Class<Component<any, any>>, object];
  /** Called when the dialog of the route is closed. The result is undefined when navigation closed it. */
  closed?: (result: any) => void;
}

/** The dialog a presenter shows for its current route. */
export interface RoutedDialog {
  route: Route;
  key: string;
  component: Component<any, any>;
  result: unknown;
}

export class BadRequestError extends Error {
  constructor(readonly code = 404, message = `Bad request (${code}).`) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export abstract class Presenter<P extends object = {}, R = void> extends Component<P, R> {
  /** Routes of the presenter, tried in this order. */
  routes: Route[] = [];

  /** Name of the current route, null when no route matches. */
  readonly route = state<string | null>(null);

  /** Parameters of the current route. A presenter whose route has no child presenter gets query parameters too. */
  readonly params = state<Params>({});

  /** Presenter shown in <RouteFrame />. */
  readonly child = state<AnyPresenter | null>(null);

  /** The part of the URL handled by the presenters above. */
  readonly basePath = state('');

  /** Used by the router to tell what has changed since the last navigation. */
  readonly routing = { matchKey: '', actionKey: '', dialog: null as RoutedDialog | null };

  /**
   * Creates a URL:
   * - `link('detail', { id: 5 })` leads to a route of this presenter, extra parameters go to the query,
   * - `link('this', { page: 2 })` is the current URL with changed query parameters, null removes one,
   * - `link('/users')` is an absolute path.
   */
  link(destination: string, params?: LinkParams): string {
    return this.app.router.link(this, destination, params);
  }

  /**
   * Goes to another URL, the arguments are the same as in link(). It replaces the current history entry
   * and runs the action of this presenter again. Unlike in Nette it does not end the method,
   * write `return this.redirect(...)`.
   */
  redirect(destination: string, params?: LinkParams): void {
    void this.app.router.navigate(this.link(destination, params), { replace: true, refresh: this });
  }

  /** Ends the action with an error, like $this->error() in Nette. */
  error(code = 404, message?: string): never {
    throw new BadRequestError(code, message);
  }

  /** Like flashMessage() in Nette. The message disappears by itself, see FlashMessages.duration. */
  flashMessage(text: string, type = 'info', options: FlashOptions = {}): void {
    this.app.flashes.add(text, type, options);
  }

  /** Called when the rest of the URL matches no route of this presenter. Override it to show something else. */
  notFound(path: string): void {
    this.error(404, `No route of ${this.constructor.name} matches '${path}'.`);
  }
}

/** The place in render() of a presenter where the presenter of its current route is shown. */
export function RouteFrame(): Child {
  const presenter = getScope()?.find<Component<any, any>>(COMPONENT);
  if (!(presenter instanceof Presenter)) throw new Error('<RouteFrame /> can be used only in render() of a presenter.');
  return () => {
    const child = presenter.child();
    return child ? renderComponent(child) : null;
  };
}
