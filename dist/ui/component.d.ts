/** Component: a class with its own state, life cycle and view. The base of presenters and dialogs. */
import { Scope } from '../reactive/reactive';
import { VIEW } from './dom';
import type { Child } from './dom';
import type { DialogOptions } from './dialog';
import type { State } from '../reactive/reactive';
import type { Resource, ResourceOptions } from './resource';
import type { Class } from '../di/container';
import type { Application } from '../application/application';
import type { LinkArgs, LinkParams, Presenter, TypedRoute } from './presenter';
/** Keys under which a scope provides the application and the component that owns it. */
export declare const APP: unique symbol;
export declare const COMPONENT: unique symbol;
/** Marks presenters, so that a component finds its presenter without importing the class. */
export declare const IS_PRESENTER: unique symbol;
type AnyComponent = Component<any, any>;
type PropsOf<C> = C extends Component<infer P, any> ? P : never;
type ResultOf<C> = C extends Component<any, infer R> ? R : never;
/**
 * Whether a component of the application has unsaved changes and would be lost with the given ones:
 * they or a component inside them (a child, a dialog opened from them). Null means the whole application.
 */
export declare function hasUnsaved(app: Application, leaving: AnyComponent[] | null): boolean;
/**
 * P are the props, R is the result the component returns when it is closed as a dialog.
 * The constructor is for services, they are autowired. Props are ready in `this.props` from the start.
 */
export declare abstract class Component<P extends object = {}, R = void> {
    readonly props: P;
    readonly parent: AnyComponent | null;
    readonly app: Application;
    /** Owns everything the component creates. Disposing it removes the component. */
    readonly scope: Scope;
    /** Set by whoever shows the component in a dialog. */
    onClose: ((result: R | undefined) => void) | null;
    constructor();
    /** The nearest presenter above the component (or the component itself), like getPresenter() in Nette. */
    get presenter(): Presenter<any, any>;
    /**
     * Creates a URL, in a component by the routes of its presenter:
     * - `link('detail', { id: 5 })` leads to a route of the presenter, extra parameters go to the query,
     * - `link('this', { page: 2 })` is the current URL with changed query parameters, null removes one,
     * - `link('/users')` is an absolute path,
     * - `link(this.detail, { id: 5 })` leads to a route made by route(), its parameters are checked by the compiler.
     */
    link<P extends object>(destination: TypedRoute<P>, ...params: LinkArgs<P>): string;
    link(destination: string, params?: LinkParams): string;
    /** The logged-in user, like $this->user in Nette. */
    get user(): import("../security").User;
    /** Runs once after the component is created, before it is rendered. Load data here. */
    startup(): void | Promise<void>;
    /** Returns the view. It is called once, later changes are done by state. */
    abstract render(): Child;
    /** Runs once the view is in the page. The place for widgets that need real elements. */
    afterRender(): void | Promise<void>;
    /** Runs when the component is removed. State, effects and listeners are cleaned up without it. */
    shutdown(): void;
    /** Title of the window when the component is shown in a dialog. */
    title(): Child;
    /** Buttons of the window when the component is shown in a dialog. */
    actions(): Child;
    /**
     * True while the component holds changes the user would lose, typically `this.form.isChanged()`.
     * Before the component leaves (another URL, Escape in its dialog, closing the page) the user is asked.
     */
    hasUnsavedChanges(): boolean;
    /**
     * Data loaded by the function, again whenever state it read before its first await changes:
     * `tasks = this.resource(() => this.api.call('task.list', { status: this.status() }))`, in the template `tasks()`.
     * With `{ tags: ['tasks'] }` also after app.invalidate('tasks').
     * Create it in the constructor or in startup(), it ends with the component. Errors go to app.onError.
     */
    resource<T>(load: () => Promise<T>, options?: ResourceOptions): Resource<T>;
    /**
     * A setting of the user that the application remembers, e.g. the width of a column:
     * `width = this.preference('tasks.width', 416)`. It is a state, every change is saved by the Preferences
     * service (localStorage unless the application registers another).
     */
    preference<T>(key: string, initial: T): State<T>;
    /** A message with OK, see Application.alert(). With `anchor` a popover at an element. */
    /** Like flashMessage() in Nette, in a component as in a presenter. It disappears by itself, see FlashMessages.duration. */
    flashMessage(text: string, type?: string, options?: Parameters<Application['flashes']['add']>[2]): void;
    alert(message: Child, options?: Parameters<Application['alert']>[1]): Promise<void>;
    /** A question with OK and Cancel, true for OK. With `anchor` a popover at an element. */
    confirm(message: Child, options?: Parameters<Application['confirm']>[1]): Promise<boolean>;
    /** A question for a text, null for Cancel. With `anchor` a popover at an element. */
    prompt(message: Child, options?: Parameters<Application['prompt']>[1]): Promise<string | null>;
    /**
     * A dialog while something runs: const loading = this.showLoading('Saving…'); … loading.close().
     * Not loading(): that is a usual name of an own field, like loading = state(false).
     */
    showLoading(message?: Child): ReturnType<Application['showLoading']>;
    /** Closes the dialog the component is shown in and hands the result to whoever opened it. It does not ask. */
    close(result?: R): void;
    /** The user closes the dialog (Escape, ×): with unsaved changes it asks first, then close(). */
    cancel(): Promise<void>;
    /**
     * Opens a component in a dialog and waits until it is closed. `{ placement: 'end' }` slides it in from the right.
     * Returns what the dialog passed to close(), or undefined when it was closed another way.
     */
    openDialog<C extends AnyComponent>(cls: Class<C>, props: PropsOf<C>, options?: DialogOptions): Promise<ResultOf<C> | undefined>;
    /** Called by the renderer for <MyComponent /> in TSX. */
    static [VIEW](this: Class<AnyComponent>, props: {
        ref?: (component: AnyComponent) => void;
    }): Child;
}
/** Creates a component with its own scope. Services in its constructor are autowired. */
export declare function createComponent<C extends AnyComponent>(cls: Class<C>, props: object, parent: AnyComponent | null, app: Application, owner: Scope | null): C;
/** Runs startup() of a component. Effects it creates before its first await belong to the component. */
export declare function startComponent(component: AnyComponent): void | Promise<void>;
/** Builds the view of a component. Call it once for every component. */
export declare function renderComponent(component: AnyComponent): Node;
/** Shows a started component in a window, the window disappears with the component. */
export declare function showDialog(dialog: AnyComponent, options?: DialogOptions): void;
export {};
