/** Component: a class with its own state, life cycle and view. The base of presenters and dialogs. */

import { Scope, getScope, state, untrack } from './reactive';
import { VIEW, insert } from './dom';
import type { Child } from './dom';
import { Dialogs } from './dialog';
import type { Class } from './di';
import type { Application } from './application';

/** Keys under which a scope provides the application and the component that owns it. */
export const APP = Symbol('application');
export const COMPONENT = Symbol('component');

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

  /** Closes the dialog the component is shown in and hands the result to whoever opened it. */
  close(result?: R): void {
    this.onClose?.(result);
  }

  /**
   * Opens a component in a dialog and waits until it is closed.
   * Returns what the dialog passed to close(), or undefined when it was closed another way.
   */
  async openDialog<C extends AnyComponent>(cls: Class<C>, props: PropsOf<C>): Promise<ResultOf<C> | undefined> {
    const dialog = createComponent(cls, props, this, this.app, this.scope);
    try {
      await dialog.startup();
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
      showDialog(dialog);
    });
  }

  /** Called by the renderer for <MyComponent /> in TSX. */
  static [VIEW](this: Class<AnyComponent>, props: { ref?: (component: AnyComponent) => void }): Child {
    const scope = getScope();
    const app = scope?.find<Application>(APP);
    if (!app) throw new Error(`<${this.name} /> can be used only inside a running Application.`);

    const component = createComponent(this, props, scope!.find<AnyComponent>(COMPONENT) ?? null, app, scope);
    props.ref?.(component);
    const started = component.startup();
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
    const component = app.container.create(cls);
    scope.provide(COMPONENT, component);
    scope.onCleanup(() => component.shutdown());
    return component;
  } catch (error) {
    scope.dispose();
    throw error;
  } finally {
    creation = null;
  }
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
export function showDialog(dialog: AnyComponent): void {
  const hide = dialog.app.container.get(Dialogs).show(dialog);
  dialog.scope.onCleanup(hide);
}
