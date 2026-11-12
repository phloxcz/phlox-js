/** Component: a class with its own state, life cycle and view. The base of presenters and dialogs. */

import { Scope, getScope, state, untrack } from '../reactive/reactive';
import { VIEW, insert } from './dom';
import type { Child } from './dom';
import { Dialogs } from './dialog';
import type { DialogOptions } from './dialog';
import { resource as createResource } from './resource';
import { Preferences } from './preferences';
import type { State } from '../reactive/reactive';
import type { Resource } from './resource';
import type { Class } from '../di/container';
import type { Application } from '../application/application';
import type { LinkParams, Presenter } from './presenter';

/** Keys under which a scope provides the application and the component that owns it. */
export const APP = Symbol('application');
export const COMPONENT = Symbol('component');
/** Marks presenters, so that a component finds its presenter without importing the class. */
export const IS_PRESENTER = Symbol('presenter');

type AnyComponent = Component<any, any>;
type PropsOf<C> = C extends Component<infer P, any> ? P : never;
type ResultOf<C> = C extends Component<any, infer R> ? R : never;

interface Creation {
  props: object;
  parent: AnyComponent | null;
  app: Application;
  scope: Scope;
}

/** What the component being constructed right now receives from the framework. */
let creation: Creation | null = null;

/** Components that exist now, for the question about unsaved changes. */
const living = new Set<AnyComponent>();
/** Dialogs closed by their code: they are leaving on purpose, so nobody asks about them. */
const closing = new WeakSet<AnyComponent>();

/**
 * Whether a component of the application has unsaved changes and would be lost with the given ones:
 * they or a component inside them (a child, a dialog opened from them). Null means the whole application.
 */
export function hasUnsaved(app: Application, leaving: AnyComponent[] | null): boolean {
  for (const component of living) {
    if (component.app !== app || !untrack(() => component.hasUnsavedChanges())) continue;
    let lost = leaving === null;
    for (let owner: AnyComponent | null = component; owner; owner = owner.parent) {
      if (closing.has(owner)) {
        lost = false;
        break;
      }
      if (leaving?.includes(owner)) lost = true;
    }
    if (lost) return true;
  }
  return false;
}

/**
 * P are the props, R is the result the component returns when it is closed as a dialog.
 * The constructor is for services, they are autowired. Props are ready in `this.props` from the start.
 */
export abstract class Component<P extends object = {}, R = void> {
  readonly props: P;
  readonly parent: AnyComponent | null;
  readonly app: Application;
  /** Owns everything the component creates. Disposing it removes the component. */
  readonly scope: Scope;
  /** Set by whoever shows the component in a dialog. */
  onClose: ((result: R | undefined) => void) | null = null;

  constructor() {
    if (!creation) {
      throw new Error(`${new.target.name} must be created by the framework: use it in TSX, in a route or in openDialog().`);
    }
    this.props = creation.props as P;
    this.parent = creation.parent;
    this.app = creation.app;
    this.scope = creation.scope;
    creation = null;
  }

  /** The nearest presenter above the component (or the component itself), like getPresenter() in Nette. */
  get presenter(): Presenter<any, any> {
    for (let owner: AnyComponent | null = this; owner; owner = owner.parent) {
      if (IS_PRESENTER in owner) return owner as unknown as Presenter<any, any>;
    }
    throw new Error(`${this.constructor.name} is not inside a presenter.`);
  }

  /**
   * Creates a URL, in a component by the routes of its presenter:
   * - `link('detail', { id: 5 })` leads to a route of the presenter, extra parameters go to the query,
   * - `link('this', { page: 2 })` is the current URL with changed query parameters, null removes one,
   * - `link('/users')` is an absolute path.
   */
  link(destination: string, params?: LinkParams): string {
    return this.app.router.link(this.presenter, destination, params);
  }

  /** The logged-in user, like $this->user in Nette. */
  get user() {
    return this.app.user;
  }

  /** Runs once after the component is created, before it is rendered. Load data here. */
  startup(): void | Promise<void> {}

  /** Returns the view. It is called once, later changes are done by state. */
  abstract render(): Child;

  /** Runs once the view is in the page. The place for widgets that need real elements. */
  afterRender(): void | Promise<void> {}

  /** Runs when the component is removed. State, effects and listeners are cleaned up without it. */
  shutdown(): void {}

  /** Title of the window when the component is shown in a dialog. */
  title(): Child {
    return '';
  }

  /** Buttons of the window when the component is shown in a dialog. */
  actions(): Child {
    return null;
  }

  /**
   * True while the component holds changes the user would lose, typically `this.form.isChanged()`.
   * Before the component leaves (another URL, Escape in its dialog, closing the page) the user is asked.
   */
  hasUnsavedChanges(): boolean {
    return false;
  }

  /**
   * Data loaded by the function, again whenever state it read before its first await changes:
   * `tasks = this.resource(() => this.api.call('task.list', { status: this.status() }))`, in the template `tasks()`.
   * Create it in the constructor or in startup(), it ends with the component. Errors go to app.onError.
   */
  resource<T>(load: () => Promise<T>): Resource<T> {
    return this.scope.run(() => createResource(load, error => this.app.onError(error)));
  }

  /**
   * A setting of the user that the application remembers, e.g. the width of a column:
   * `width = this.preference('tasks.width', 416)`. It is a state, every change is saved by the Preferences
   * service (localStorage unless the application registers another).
   */
  preference<T>(key: string, initial: T): State<T> {
    return this.app.container.get(Preferences).state(key, initial);
  }

  /** A message with OK, see Application.alert(). With `anchor` a popover at an element. */
  alert(message: Child, options: Parameters<Application['alert']>[1] = {}): Promise<void> {
    return this.app.alert(message, options, this);
  }

  /** A question with OK and Cancel, true for OK. With `anchor` a popover at an element. */
  confirm(message: Child, options: Parameters<Application['confirm']>[1] = {}): Promise<boolean> {
    return this.app.confirm(message, options, this);
  }

  /** A question for a text, null for Cancel. With `anchor` a popover at an element. */
  prompt(message: Child, options: Parameters<Application['prompt']>[1] = {}): Promise<string | null> {
    return this.app.prompt(message, options, this);
  }

  /** A dialog while something runs: const loading = this.loading('Saving…'); … loading.close(). */
  loading(message?: Child): ReturnType<Application['loading']> {
    return this.app.loading(message, this);
  }

  /** Closes the dialog the component is shown in and hands the result to whoever opened it. It does not ask. */
  close(result?: R): void {
    closing.add(this);
    this.onClose?.(result);
  }

  /** The user closes the dialog (Escape, ×): with unsaved changes it asks first, then close(). */
  async cancel(): Promise<void> {
    if (await this.app.mayLeave([this], this)) this.close();
  }

  /**
   * Opens a component in a dialog and waits until it is closed. `{ placement: 'end' }` slides it in from the right.
   * Returns what the dialog passed to close(), or undefined when it was closed another way.
   */
  async openDialog<C extends AnyComponent>(cls: Class<C>, props: PropsOf<C>, options?: DialogOptions): Promise<ResultOf<C> | undefined> {
    const dialog = createComponent(cls, props, this, this.app, this.scope);
    try {
      await startComponent(dialog);
    } catch (error) {
      dialog.scope.dispose();
      throw error;
    }
    // The opener may have been removed while the dialog was starting
    if (dialog.scope.disposed) return undefined;

    return new Promise(resolve => {
      let result: ResultOf<C> | undefined;
      dialog.scope.onCleanup(() => resolve(result));
      dialog.onClose = value => {
        result = value;
        dialog.scope.dispose();
      };
      showDialog(dialog, options);
    });
  }

  /** Called by the renderer for <MyComponent /> in TSX. */
  static [VIEW](this: Class<AnyComponent>, props: { ref?: (component: AnyComponent) => void }): Child {
    const scope = getScope();
    const app = scope?.find<Application>(APP);
    if (!app) throw new Error(`<${this.name} /> can be used only inside a running Application.`);

    const component = createComponent(this, props, scope!.find<AnyComponent>(COMPONENT) ?? null, app, scope);
    props.ref?.(component);
    const started = startComponent(component);
    if (!(started instanceof Promise)) return renderComponent(component);

    // The view appears when the data is loaded
    const ready = state(false);
    started.then(() => component.scope.disposed || ready.set(true), error => app.onError(error));
    return () => (ready() ? renderComponent(component) : null);
  }
}

/** Creates a component with its own scope. Services in its constructor are autowired. */
export function createComponent<C extends AnyComponent>(
  cls: Class<C>, props: object, parent: AnyComponent | null, app: Application, owner: Scope | null,
): C {
  const scope = new Scope(owner);
  creation = { props, parent, app, scope };
  try {
    // Effects and computed values made in field initializers and in the constructor belong to the component
    const component = scope.run(() => app.container.create(cls));
    scope.provide(COMPONENT, component);
    living.add(component);
    scope.onCleanup(() => living.delete(component));
    scope.onCleanup(() => component.shutdown());
    return component;
  } catch (error) {
    scope.dispose();
    throw error;
  } finally {
    creation = null;
  }
}

/** Runs startup() of a component. Effects it creates before its first await belong to the component. */
export function startComponent(component: AnyComponent): void | Promise<void> {
  return component.scope.run(() => component.startup());
}

/** Builds the view of a component. Call it once for every component. */
export function renderComponent(component: AnyComponent): Node {
  const fragment = document.createDocumentFragment();
  component.scope.run(() => untrack(() => insert(fragment, component.render(), null)));
  // The caller puts the view into the page right after this, so a microtask later it is there
  queueMicrotask(async () => {
    if (component.scope.disposed) return;
    try {
      await component.afterRender();
    } catch (error) {
      component.app.onError(error);
    }
  });
  return fragment;
}

/** Shows a started component in a window, the window disappears with the component. */
export function showDialog(dialog: AnyComponent, options?: DialogOptions): void {
  const hide = dialog.app.container.get(Dialogs).show(dialog, options);
  dialog.scope.onCleanup(hide);
}
