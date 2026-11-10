/** Application: starts the root presenter and the router. Together with the container it is the bootstrap. */

import { Scope, state } from './reactive';
import { Container } from './di';
import type { Class } from './di';
import { APP, createComponent, renderComponent } from './component';
import { Dialogs, NativeDialogs } from './dialog';
import type { Presenter } from './presenter';
import { Router } from './router';
import { Authenticator, User, UserStorage, userDefaults } from './security/user';
import { Authorizator } from './security/permission';

export interface Flash {
  text: string;
  type: string;
}

/** Flash messages. Show them in the layout: `<For each={this.app.flashes.messages}>`. */
export class FlashMessages {
  readonly messages = state<Flash[]>([]);

  add(text: string, type = 'info'): Flash {
    const flash = { text, type };
    this.messages.update(list => [...list, flash]);
    return flash;
  }

  remove(flash: Flash): void {
    this.messages.update(list => list.filter(other => other !== flash));
  }
}

export class Application {
  readonly router: Router;
  readonly flashes: FlashMessages;
  readonly user: User;

  /** The root presenter while the application is running. */
  presenter: Presenter<any, any> | null = null;

  /** Receives errors from navigation and from life cycle methods that nobody awaits. */
  onError: (error: unknown) => void = error => console.error(error);

  private scope: Scope | null = null;
  private started: { root: Class<Presenter<any, any>>; element: Element } | null = null;

  /** The container holds services of the application. Services of the framework are added unless it has its own. */
  constructor(readonly container = new Container()) {
    container.add(this);
    if (!container.has(Dialogs)) container.add(NativeDialogs);
    if (!container.has(FlashMessages)) container.add(FlashMessages);
    if (!container.has(UserStorage)) container.add(userDefaults.BrowserUserStorage);
    if (!container.has(Authenticator)) container.add(userDefaults.MissingAuthenticator);
    if (!container.has(Authorizator)) container.add(userDefaults.MissingAuthorizator);
    if (!container.has(User)) container.add(User);
    this.flashes = container.get(FlashMessages);
    this.user = container.get(User);
    this.router = new Router(this);
    container.add(this.router);
  }

  /** Creates the root presenter, routes the current URL and shows the result in the element. */
  async run(root: Class<Presenter<any, any>>, element: Element): Promise<void> {
    if (this.scope) throw new Error('The application is already running.');
    this.started = { root, element };
    this.scope = new Scope(null);
    this.scope.provide(APP, this);

    const presenter = this.presenter = createComponent(root, {}, null, this, this.scope);
    await presenter.startup();
    document.addEventListener('click', this.onClick);
    await this.router.start(presenter);
    element.replaceChildren(renderComponent(presenter));
  }

  /** Removes everything and stops routing. */
  stop(): void {
    document.removeEventListener('click', this.onClick);
    this.router.stop();
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

  /** A click on an ordinary link to this site becomes a navigation without a page reload. */
  private onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link || link.target || link.hasAttribute('download') || link.origin !== location.origin) return;
    event.preventDefault();
    void this.router.navigate(link.pathname + link.search + link.hash);
  };
}
