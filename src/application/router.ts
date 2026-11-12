/**
 * Router: walks the tree of presenters from the root and gives each of them its part of the URL.
 * Only one navigation runs at a time. A newer one waits for it and the running one gives up at its next step.
 */

import { batch, state, untrack } from '../reactive/reactive';
import { createComponent, showDialog, startComponent } from '../ui/component';
import type { Component } from '../ui/component';
import { Presenter } from '../ui/presenter';
import type { LinkParams, Params, Route, RoutedDialog } from '../ui/presenter';
import type { Class } from '../di/container';
import type { Application } from './application';

type AnyPresenter = Presenter<any, any>;

interface Navigation {
  url: string;
  /** What to do with browser history when the navigation succeeds. */
  history: 'push' | 'replace' | 'none';
  /** Actions of this presenter and of those below it run even when nothing has changed. */
  refresh: AnyPresenter | null;
  /** Back or Forward of the browser: the URL has already changed. */
  pop?: boolean;
}

/** Thrown inside a navigation that has been replaced by a newer one. */
const SUPERSEDED = Symbol('superseded');
/** Thrown when the user stays because of unsaved changes. */
const CANCELLED = Symbol('cancelled');

/** A presenter without routes is a single page, its action is actionDefault(). */
const DEFAULT_ROUTES: Route[] = [{ name: 'default', pattern: '/' }];

const patterns = new Map<string, RegExp>();
const loaded = new WeakMap<Route, Class<AnyPresenter>>();

/** `/users/<id \d+>` becomes a regular expression with named groups. It must end at a slash or at the end. */
function toRegExp(pattern: string): RegExp {
  let regExp = patterns.get(pattern);
  if (!regExp) {
    const source = pattern.replace(/<(\w+)(?:\s+([^>]+))?>|[.*+?^${}()|[\]\\]/g, (text, name?: string, expression?: string) =>
      name ? `(?<${name}>${expression ?? '[^/]+'})` : `\\${text}`);
    // `/` is the route for "nothing more", an empty pattern takes nothing and passes everything on
    regExp = new RegExp(pattern === '/' ? '^/?$' : `^${source}(?=/|$)`);
    patterns.set(pattern, regExp);
  }
  return regExp;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // a broken link must not stop the application
  }
}

/** Finds the first route that matches the beginning of the path, or all of it when nothing handles the rest. */
function match(routes: Route[], path: string) {
  for (const route of routes) {
    const found = toRegExp(route.pattern).exec(path);
    if (!found) continue;
    const remaining = path.slice(found[0].length);
    const exact = remaining === '' || remaining === '/';
    if (!exact && !route.presenter && !route.dialog) continue;

    const params: Params = {};
    for (const [name, value] of Object.entries(found.groups ?? {})) {
      if (value !== undefined) params[name] = decode(value);
    }
    return { route, params, matched: found[0] === '/' ? '' : found[0], remaining, exact };
  }
  return null;
}

async function loadPresenter(route: Route): Promise<Class<AnyPresenter>> {
  let cls = loaded.get(route);
  if (!cls) {
    const source = route.presenter!;
    if (source.prototype instanceof Presenter) {
      cls = source as Class<AnyPresenter>;
    } else {
      const module = await (source as () => Promise<Class<AnyPresenter> | { default: Class<AnyPresenter> }>)();
      cls = 'default' in module ? module.default : module;
    }
    loaded.set(route, cls);
  }
  return cls;
}

function splitUrl(url: string): { path: string; query: Params; full: string } {
  const parsed = new URL(url, location.origin);
  const path = parsed.pathname.length > 1 && parsed.pathname.endsWith('/') ? parsed.pathname.slice(0, -1) : parsed.pathname;
  // Own properties only, a key like __proto__ cannot reach Object.prototype this way
  const query: Params = Object.fromEntries(parsed.searchParams);
  return { path, query, full: path + parsed.search + parsed.hash };
}

function joinUrl(path: string, query: LinkParams): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) search.set(name, String(value));
  }
  const clean = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return (clean || '/') + (search.size > 0 ? `?${search}` : '');
}

export class Router {
  /** Path and query of the page that is shown. */
  readonly url = state('');

  private root: AnyPresenter | null = null;
  /** The position in history of the page that is shown, to return Back when the user stays. */
  private index = 0;
  private returning = false;
  private running: Navigation | null = null;
  /** Presenters created but not started: startup() runs once the router knows their route and parameters. */
  private pending = new WeakSet<AnyPresenter>();
  private queued: { navigation: Navigation; done: () => void } | null = null;

  constructor(private app: Application) {}

  /** Starts routing from the current URL of the browser. */
  start(root: AnyPresenter): Promise<void> {
    this.root = root;
    this.pending.add(root);
    this.index = history.state?.phlox ?? 0;
    window.addEventListener('popstate', this.onPopState);
    return this.enqueue({ url: location.href, history: 'none', refresh: null });
  }

  stop(): void {
    window.removeEventListener('popstate', this.onPopState);
    this.root = null;
  }

  /** Goes to the URL. The promise is fulfilled when the navigation ends, even if it fails or a newer one replaces it. */
  navigate(url: string, options: { replace?: boolean; refresh?: AnyPresenter } = {}): Promise<void> {
    return this.enqueue({ url, history: options.replace ? 'replace' : 'push', refresh: options.refresh ?? null });
  }

  /** Creates a URL, see Presenter.link(). */
  link(presenter: AnyPresenter, destination: string, params: LinkParams = {}): string {
    if (destination === 'this') {
      const current = splitUrl(this.running ? this.running.url : this.url());
      return joinUrl(current.path, { ...current.query, ...params });
    }
    if (destination.startsWith('/')) return joinUrl(this.base + destination, params);

    const route = presenter.routes.find(candidate => candidate.name === destination);
    if (!route) throw new Error(`${presenter.constructor.name} has no route '${destination}'.`);
    const query = { ...this.persistentOf(presenter), ...params };
    const path = route.pattern.replace(/<(\w+)[^>]*>/g, (_text, name: string) => {
      const value = params[name];
      // 0 and false are valid values
      if (value === undefined || value === null || value === '') {
        throw new Error(`Missing parameter '${name}' for route '${destination}' of ${presenter.constructor.name}.`);
      }
      delete query[name];
      return encodeURIComponent(String(value));
    });
    return joinUrl(presenter.basePath() + path, query);
  }

  /** Current values of the persistent parameters of the presenter and of the presenters above it. */
  private persistentOf(presenter: AnyPresenter): LinkParams {
    return this.persistentQuery(presenter, splitUrl(this.running ? this.running.url : this.url()).query);
  }

  /** The parameters of the query that are persistent for the presenter or for a presenter above it. */
  private persistentQuery(presenter: AnyPresenter, query: Params): Params {
    const names: string[] = [];
    for (let owner: Component<any, any> | null = presenter; owner; owner = owner.parent) {
      if (owner instanceof Presenter) names.push(...owner.persistent);
    }
    if (!names.length) return {};
    const kept = (name: string) => names.some(pattern => (pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern));
    return Object.fromEntries(Object.entries(query).filter(([name]) => kept(name)));
  }

  /** The base path of the application without the slash at the end, see Application.basePath. */
  get base(): string {
    return this.app.basePath.replace(/\/+$/, '');
  }

  /** Whether the path belongs to the application, that is it lies under its base path. */
  owns(path: string): boolean {
    return !this.base || path === this.base || path.startsWith(`${this.base}/`);
  }

  private onPopState = (): void => {
    if (this.returning) {
      this.returning = false;
      return;
    }
    void this.enqueue({ url: location.href, history: 'none', refresh: null, pop: true });
  };

  /** The user stays after Back or Forward: the browser goes back to the page that is shown. */
  private returnBack(): void {
    const steps = (history.state?.phlox ?? 0) - this.index;
    if (steps) {
      this.returning = true;
      history.go(-steps);
    } else {
      history.pushState({ phlox: this.index }, '', this.url());
    }
  }

  private enqueue(navigation: Navigation): Promise<void> {
    if (!this.running) return this.process(navigation);
    // A redirect from a navigation that has not written to history yet takes over its intent
    if (navigation.history === 'replace' && this.running.history === 'push') navigation.history = 'push';
    this.queued?.done();
    return new Promise(done => {
      this.queued = { navigation, done };
    });
  }

  private async process(navigation: Navigation): Promise<void> {
    this.running = navigation;
    try {
      await this.run(navigation);
    } catch (error) {
      if (error !== SUPERSEDED && error !== CANCELLED) this.app.onError(error);
    } finally {
      this.running = null;
      const next = this.queued;
      this.queued = null;
      if (next) void this.process(next.navigation).then(next.done);
    }
  }

  /**
   * Prepares the whole new state aside: runs actions and creates and starts new presenters and dialogs.
   * The page changes only at the end, so the old screen stays until the new one is ready.
   */
  private async run(navigation: Navigation): Promise<void> {
    const { path, query, full } = splitUrl(navigation.url);
    // Another page of the site, outside the base path, is loaded by the browser
    if (!this.owns(path)) return location.assign(full);
    const commits: (() => void)[] = [];
    const created: Component<any, any>[] = [];
    // Components the new page removes, and how to put back the state of presenters that stay
    const leaving: Component<any, any>[] = [];
    const undo: (() => void)[] = [];
    const changed: { presenter: AnyPresenter; matchKey: string }[] = [];
    const check = (): void => {
      if (this.queued) throw SUPERSEDED;
    };
    const start = async (presenter: AnyPresenter): Promise<void> => {
      if (!this.pending.delete(presenter)) return;
      await startComponent(presenter);
      check();
    };

    try {
      let presenter = this.root;
      let base = this.base;
      let rest = path.slice(base.length) || '/';
      let refresh = false;

      while (presenter) {
        const current: AnyPresenter = presenter;
        const routing = current.routing;
        refresh ||= current === navigation.refresh;
        const found = match(current.routes.length > 0 ? current.routes : DEFAULT_ROUTES, rest);

        if (!found) {
          if (this.pending.has(current)) {
            batch(() => {
              current.basePath.set(base);
              current.route.set(null);
              current.params.set({});
            });
            await start(current);
          }
          // Throws unless the presenter handles an unknown URL itself, then nothing changes
          current.notFound(rest);
          changed.push({ presenter: current, matchKey: routing.matchKey });
          undo.push(this.snapshot(current));
          if (routing.dialog) leaving.push(routing.dialog.component);
          const old = untrack(current.child);
          if (old) leaving.push(old);
          routing.matchKey = routing.actionKey = '';
          batch(() => {
            current.basePath.set(base);
            current.route.set(null);
            current.params.set({});
          });
          commits.push(() => {
            if (routing.dialog) this.closeDialog(current, routing.dialog);
            this.replaceChild(current, null);
          });
          break;
        }

        const { route, params, matched, remaining, exact } = found;
        // Query parameters go to the end of the chain; a presenter above it gets its persistent ones
        const all = route.presenter ? { ...this.persistentQuery(current, query), ...params } : { ...query, ...params };
        const matchKey = JSON.stringify([route.name, params]);
        const actionKey = JSON.stringify([route.name, all]);
        const routeChanged = matchKey !== routing.matchKey;
        const actionChanged = actionKey !== routing.actionKey;
        if (routeChanged || actionChanged) changed.push({ presenter: current, matchKey: routing.matchKey });
        undo.push(this.snapshot(current));
        routing.matchKey = matchKey;
        routing.actionKey = actionKey;
        batch(() => {
          current.basePath.set(base);
          current.route.set(route.name);
          if (actionChanged) current.params.set(all);
        });
        // Like in Nette, startup() of a new presenter already knows its parameters
        await start(current);

        if (actionChanged || refresh) {
          const action = `action${route.name.charAt(0).toUpperCase()}${route.name.slice(1)}`;
          await (current as unknown as Record<string, ((params: Params) => unknown) | undefined>)[action]?.(all);
          check();
        }

        let next: AnyPresenter | null = null;
        const dialog = await this.prepareDialog(current, route, params, commits, created, leaving);
        check();
        if (dialog instanceof Presenter) next = dialog;

        if (route.presenter) {
          const cls = await loadPresenter(route);
          check();
          const old = untrack(current.child);
          if (old && !routeChanged && old.constructor === cls) {
            next = old;
          } else {
            if (old) leaving.push(old);
            const child = createComponent(cls, route.props?.(params) ?? {}, current, this.app, current.scope);
            created.push(child);
            this.pending.add(child);
            commits.push(() => this.replaceChild(current, child));
            next = child;
          }
        } else if (untrack(current.child)) {
          leaving.push(untrack(current.child)!);
          commits.push(() => this.replaceChild(current, null));
        }

        if (!next && !exact) {
          current.notFound(rest);
          break;
        }
        base += matched;
        rest = remaining || '/';
        presenter = next;
      }
      check();
      // The new page is ready aside; components with unsaved changes would be lost, so the user decides
      if (leaving.length && !(await this.app.mayLeave(leaving))) {
        if (navigation.pop) this.returnBack();
        throw CANCELLED;
      }
      check();
    } catch (error) {
      for (const component of created) component.scope.dispose();
      if (error === CANCELLED) for (const restore of undo) restore();
      // Children still belong to the old routes, but the actions must run again next time
      for (const { presenter, matchKey } of changed) presenter.routing.matchKey = matchKey, presenter.routing.actionKey = '';
      throw error;
    }

    for (const commit of commits) commit();
    const index: number = history.state?.phlox ?? 0;
    const shown = location.pathname + location.search + location.hash;
    if (navigation.history === 'push' && full !== shown) history.pushState({ phlox: index + 1 }, '', full);
    else if (navigation.history !== 'none') history.replaceState({ phlox: index }, '', full);
    this.index = history.state?.phlox ?? 0;
    this.url.set(joinUrl(path, query));
  }

  /** Remembers where the presenter is, to put it back when the user stays. */
  private snapshot(presenter: AnyPresenter): () => void {
    const route = untrack(presenter.route), params = untrack(presenter.params), base = untrack(presenter.basePath);
    return () => batch(() => {
      presenter.route.set(route);
      presenter.params.set(params);
      presenter.basePath.set(base);
    });
  }

  /** Keeps the dialog of the route when it is already open, otherwise prepares a new one and closes the old one. */
  private async prepareDialog(
    presenter: AnyPresenter, route: Route, params: Params, commits: (() => void)[], created: Component<any, any>[],
    leaving: Component<any, any>[],
  ): Promise<Component<any, any> | null> {
    const active = presenter.routing.dialog;
    const key = route.dialog ? JSON.stringify([route.name, params]) : null;
    if (active && active.key === key) return active.component;
    if (active) {
      leaving.push(active.component);
      commits.push(() => this.closeDialog(presenter, active));
    }
    if (!route.dialog) return null;

    const [cls, props, options] = route.dialog(params);
    const component = createComponent(cls, props, presenter, this.app, presenter.scope);
    created.push(component);
    // A presenter in a dialog is started when the router comes to it, as any other presenter
    if (component instanceof Presenter && !route.presenter) this.pending.add(component);
    else await startComponent(component);
    const dialog: RoutedDialog = { route, key: key!, component, result: undefined };
    component.onClose = result => {
      dialog.result = result;
      this.leaveDialog(presenter);
    };
    commits.push(() => {
      presenter.routing.dialog = dialog;
      showDialog(component, options);
    });
    return component;
  }

  private closeDialog(presenter: AnyPresenter, dialog: RoutedDialog): void {
    // A dialog that is a presenter may have its own dialogs open above it
    if (dialog.component instanceof Presenter) this.closeDialogsOf(dialog.component);
    if (presenter.routing.dialog === dialog) presenter.routing.dialog = null;
    dialog.component.scope.dispose();
    dialog.route.closed?.call(presenter, dialog.result);
  }

  /**
   * Closes the routed dialogs of a presenter that is leaving, and of the presenters below it,
   * the topmost first, so that every `closed` learns about it.
   */
  private closeDialogsOf(presenter: AnyPresenter): void {
    const child = untrack(presenter.child);
    if (child) this.closeDialogsOf(child);
    if (presenter.routing.dialog) this.closeDialog(presenter, presenter.routing.dialog);
  }

  /**
   * Leaves the URL of a dialog. Inside the application it goes back, so the Back button does not reopen the dialog.
   * After a direct link there is nowhere to go back, so the URL of the presenter replaces the URL of the dialog.
   */
  private leaveDialog(presenter: AnyPresenter): void {
    if ((history.state?.phlox ?? 0) > 0) history.back();
    else void this.navigate(joinUrl(untrack(presenter.basePath) || '/', this.persistentOf(presenter)), { replace: true });
  }

  /** The old presenter is shut down while its view is still in the page. */
  private replaceChild(presenter: AnyPresenter, child: AnyPresenter | null): void {
    const old = untrack(presenter.child);
    if (old === child) return;
    if (old) this.closeDialogsOf(old);
    old?.scope.dispose();
    presenter.child.set(child);
  }
}
