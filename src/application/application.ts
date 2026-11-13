/** Application: starts the root presenter and the router. Together with the container it is the bootstrap. */

import { Scope, batch, effect, state, untrack } from '../reactive/reactive';
import type { State } from '../reactive/reactive';
import { resource as createResource } from '../ui/resource';
import type { Resource, ResourceOptions } from '../ui/resource';
import { ERRORS, h, insert } from '../ui/dom';
import type { Child } from '../ui/dom';
import { Container } from '../di/container';
import type { Class } from '../di/container';
import { APP, createComponent, hasUnsaved, renderComponent } from '../ui/component';
import type { Component } from '../ui/component';
import { Toasts, messageTexts, showLoading, showMessage } from '../ui/messages';
import type { LoadingHandle, MessageOptions, PromptOptions } from '../ui/messages';
import { Dialogs, NativeDialogs } from '../ui/dialog';
import { THEME, Theme } from '../ui/theme';
import type { Presenter } from '../ui/presenter';
import { Router } from './router';
import { Authenticator, User, UserStorage, userDefaults } from '../security/user';
import { BrowserPreferences, Preferences } from '../ui/preferences';
import { Authorizator } from '../security/permission';

export interface Flash {
  text: string;
  /** `info`, `success`, `warning` or `error`. */
  type: string;
  title?: string;
  /** How long it stays, in ms, 0 = until closed. */
  duration: number;
}

export interface FlashOptions {
  /** After how many ms the message disappears, 0 = it stays until removed. */
  duration?: number;
  /** A bold line above the text. */
  title?: string;
}

export type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

/**
 * Flash messages. The application shows them as toasts. A layout that shows them itself
 * (`<For each={this.app.flashes.messages}>`) sets `toasts = false`; an adapter can show them by a library.
 */
export class FlashMessages {
  readonly messages = state<Flash[]>([]);
  /** How long a message stays, in ms. 0 = until removed. */
  duration = 5000;
  /** Errors stay until the user closes them, the user should not miss them. */
  errorDuration = 0;
  /** The application shows the messages as toasts. */
  toasts = true;
  /** The corner of the toasts. */
  position: ToastPosition = 'top-right';

  private timers = new Map<Flash, { timer: ReturnType<typeof setTimeout> | null; ends: number; left: number }>();

  add(text: string, type = 'info', options: FlashOptions = {}): Flash {
    const duration = options.duration ?? (type === 'error' ? this.errorDuration : this.duration);
    const flash: Flash = { text, type, duration, ...(options.title ? { title: options.title } : {}) };
    this.messages.update(list => [...list, flash]);
    if (duration > 0) {
      this.timers.set(flash, { timer: null, ends: 0, left: duration });
      this.resume(flash);
    }
    return flash;
  }

  remove(flash: Flash): void {
    const running = this.timers.get(flash);
    if (running?.timer) clearTimeout(running.timer);
    this.timers.delete(flash);
    this.messages.update(list => list.filter(other => other !== flash));
  }

  clear(): void {
    for (const flash of [...this.timers.keys()]) this.remove(flash);
    this.messages.set([]);
  }

  /** Stops the time of a message, while the user reads it (the pointer or the focus is on it). */
  pause(flash: Flash): void {
    const running = this.timers.get(flash);
    if (!running?.timer) return;
    clearTimeout(running.timer);
    running.timer = null;
    running.left = Math.max(0, running.ends - Date.now());
  }

  resume(flash: Flash): void {
    const running = this.timers.get(flash);
    if (!running || running.timer) return;
    running.ends = Date.now() + running.left;
    running.timer = setTimeout(() => this.remove(flash), running.left);
  }
}

export class Application {
  readonly router: Router;
  readonly flashes: FlashMessages;
  readonly user: User;
  /** Classes of rendered forms and dialogs, see ui/theme.ts. */
  readonly theme: Theme;

  /** The root presenter while the application is running. */
  presenter: Presenter<any, any> | null = null;

  /**
   * The path the application lives under when it is not at the root of the site, like '/admin'.
   * Routes and links are relative to it, links outside it load another page. Set it before run().
   */
  basePath = '';

  /**
   * Composes document.title from the title of the page (Presenter.pageTitle()). By default
   * "Page – <the title in index.html>", without a page only the title in index.html.
   */
  formatTitle: (page: string | null) => string = page => (page ? `${page} – ${this.baseTitle}` : this.baseTitle);

  /** Receives errors from navigation and from life cycle methods that nobody awaits. */
  onError: (error: unknown) => void = error => console.error(error);

  private scope: Scope | null = null;
  /** Versions of the tags of data, see invalidate(). */
  private versions = new Map<string, State<number>>();
  private started: { root: Class<Presenter<any, any>>; element: Element } | null = null;
  private toastHost: HTMLElement | null = null;
  /** The title of the page before the application changed it. */
  private baseTitle = '';
  /** Tells screen readers that another page is shown, see navigated(). */
  private announcer: HTMLElement | null = null;

  /** The container holds services of the application. Services of the framework are added unless it has its own. */
  constructor(readonly container = new Container()) {
    container.add(this);
    if (!container.has(Dialogs)) container.add(NativeDialogs);
    if (!container.has(FlashMessages)) container.add(FlashMessages);
    if (!container.has(Theme)) container.add(new Theme());
    if (!container.has(UserStorage)) container.add(userDefaults.BrowserUserStorage);
    if (!container.has(Preferences)) container.add(new BrowserPreferences());
    if (!container.has(Authenticator)) container.add(userDefaults.MissingAuthenticator);
    if (!container.has(Authorizator)) container.add(userDefaults.MissingAuthorizator);
    if (!container.has(User)) container.add(User);
    this.flashes = container.get(FlashMessages);
    this.user = container.get(User);
    this.theme = container.get(Theme);
    this.router = new Router(this);
    container.add(this.router);
  }

  /** Creates the root presenter, routes the current URL and shows the result in the element. */
  async run(root: Class<Presenter<any, any>>, element: Element): Promise<void> {
    if (this.scope) throw new Error('The application is already running.');
    this.started = { root, element };
    this.scope = new Scope(null);
    this.scope.provide(APP, this);
    this.scope.provide(THEME, this.theme);
    // Errors of event handlers, also of async ones, go to onError like errors of navigation
    this.scope.provide(ERRORS, (error: unknown) => this.onError(error));

    const presenter = this.presenter = createComponent(root, {}, null, this, this.scope);
    document.addEventListener('click', this.onClick);
    window.addEventListener('beforeunload', this.onBeforeUnload);
    await this.router.start(presenter);
    element.replaceChildren(renderComponent(presenter));
    this.baseTitle = document.title;
    this.scope.run(() => effect(() => {
      document.title = this.formatTitle(this.pageTitle());
    }));
    const announcer = this.announcer = document.createElement('div');
    announcer.className = 'phlox-announcer';
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    document.body.append(announcer);
    if (this.flashes.toasts) {
      const host = this.toastHost = document.createElement('div');
      document.body.append(host);
      this.scope.run(() => insert(host, h(Toasts, { flashes: this.flashes }), null));
    }
  }

  /** A message with OK, as a dialog or, with `anchor`, as a popover at an element. */
  alert(message: Child, options: MessageOptions = {}, opener?: Component<any, any>): Promise<void> {
    return showMessage(this.opener(opener), 'alert', message, options).then(() => undefined);
  }

  /** A question with OK and Cancel. True for OK; Escape, a click outside or Cancel is false. */
  confirm(message: Child, options: MessageOptions = {}, opener?: Component<any, any>): Promise<boolean> {
    return showMessage(this.opener(opener), 'confirm', message, options) as Promise<boolean>;
  }

  /** A question for a text. The text for OK, null for Cancel. */
  prompt(message: Child, options: PromptOptions = {}, opener?: Component<any, any>): Promise<string | null> {
    return showMessage(this.opener(opener), 'prompt', message, options) as Promise<string | null>;
  }

  /** A dialog without buttons while something runs; close it by the returned handle. */
  loading(message: Child = undefined, opener?: Component<any, any>): LoadingHandle {
    return showLoading(this.opener(opener).scope, message);
  }

  /**
   * The data with these tags have changed on the server: every resource with one of them loads again,
   * on whatever screen it is. Calls made at once go to the server as one batch.
   *   await this.api.call('task.update', …); this.app.invalidate('tasks');
   */
  invalidate(...tags: string[]): void {
    batch(() => {
      for (const tag of tags) this.version(tag).update(version => version + 1);
    });
  }

  /**
   * A resource of the whole application, for services that hold data many screens show (users, projects).
   * It lives while the application runs. Components use Component.resource().
   */
  resource<T>(load: () => Promise<T>, options: ResourceOptions = {}): Resource<T> {
    if (!this.scope) throw new Error('app.resource() needs a running application.');
    return this.createResource(this.scope, load, options);
  }

  /** A resource owned by the scope, reading the versions of its tags. Used by resource() and Component.resource(). */
  createResource<T>(scope: Scope, load: () => Promise<T>, options: ResourceOptions = {}): Resource<T> {
    const tags = options.tags ?? [];
    return scope.run(() => createResource(() => {
      for (const tag of tags) this.version(tag)();
      return load();
    }, error => this.onError(error)));
  }

  private version(tag: string): State<number> {
    let version = this.versions.get(tag);
    if (!version) this.versions.set(tag, version = state(0));
    return version;
  }

  /**
   * Whether the components may leave: true without unsaved changes in them, otherwise the user decides.
   * Null means the whole application. The router and Component.cancel() ask through it.
   */
  async mayLeave(leaving: Component<any, any>[] | null, opener?: Component<any, any>): Promise<boolean> {
    if (!hasUnsaved(this, leaving)) return true;
    return this.confirm(messageTexts.unsaved, { danger: true, okText: messageTexts.leave }, opener);
  }

  private opener(component?: Component<any, any>): Component<any, any> {
    const opener = component ?? this.presenter;
    if (!opener) throw new Error('Messages need a running application.');
    return opener;
  }

  /** The title of the deepest presenter that has one. Reactive. */
  private pageTitle(): string | null {
    let title: string | null = null;
    for (let presenter = this.presenter; presenter; presenter = presenter.child()) title = presenter.pageTitle() ?? title;
    return title;
  }

  /**
   * After a navigation has changed the page. Screen readers hear the title of the new page. When the focus
   * was on something the old page took away, it goes to the main heading of the new one; otherwise it stays
   * (a list with its detail would lose its place).
   */
  navigated(): void {
    const announcer = this.announcer;
    if (!announcer) return;
    // Emptied first, the same text twice would not be read again
    announcer.textContent = '';
    setTimeout(() => {
      announcer.textContent = document.title;
    }, 50);
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const heading = untrack(() => this.started?.element.querySelector<HTMLElement>('h1'));
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }

  /** Removes everything and stops routing. */
  stop(): void {
    document.removeEventListener('click', this.onClick);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    this.router.stop();
    this.toastHost?.remove();
    this.toastHost = null;
    this.announcer?.remove();
    this.announcer = null;
    if (this.baseTitle) document.title = this.baseTitle;
    this.scope?.dispose();
    this.scope = null;
    this.presenter = null;
    this.started?.element.replaceChildren();
  }

  /** Builds the whole tree of presenters again at the same URL, for example after a change of language. */
  async restart(): Promise<void> {
    if (!this.started) throw new Error('The application has not been started.');
    const { root, element } = this.started;
    this.stop();
    await this.run(root, element);
  }

  /** Closing or reloading the page, a link to another site: the browser asks with its own question. */
  private onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (hasUnsaved(this, null)) event.preventDefault();
  };

  /** A click on an ordinary link to this site becomes a navigation without a page reload. */
  private onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link || link.target || link.hasAttribute('download') || link.origin !== location.origin) return;
    if (!this.router.owns(link.pathname)) return;
    event.preventDefault();
    void this.router.navigate(link.pathname + link.search + link.hash);
  };
}
