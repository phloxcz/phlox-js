/** Application: starts the root presenter and the router. Together with the container it is the bootstrap. */
import { Scope } from '../reactive/reactive';
import type { State } from '../reactive/reactive';
import type { Resource, ResourceOptions } from '../ui/resource';
import type { Child } from '../ui/dom';
import { Container } from '../di/container';
import type { Class } from '../di/container';
import type { Component } from '../ui/component';
import type { LoadingHandle, MessageOptions, PromptOptions } from '../ui/messages';
import { Theme } from '../ui/theme';
import type { Presenter } from '../ui/presenter';
import { Router } from './router';
import { User } from '../security/user';
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
export declare class FlashMessages {
    readonly messages: State<Flash[]>;
    /** How long a message stays, in ms. 0 = until removed. */
    duration: number;
    /** Errors stay until the user closes them, the user should not miss them. */
    errorDuration: number;
    /** The application shows the messages as toasts. */
    toasts: boolean;
    /** The corner of the toasts. */
    position: ToastPosition;
    private timers;
    add(text: string, type?: string, options?: FlashOptions): Flash;
    remove(flash: Flash): void;
    clear(): void;
    /** Stops the time of a message, while the user reads it (the pointer or the focus is on it). */
    pause(flash: Flash): void;
    resume(flash: Flash): void;
}
export declare class Application {
    readonly container: Container;
    readonly router: Router;
    readonly flashes: FlashMessages;
    readonly user: User;
    /** Classes of rendered forms and dialogs, see ui/theme.ts. */
    readonly theme: Theme;
    /** The root presenter while the application is running. */
    presenter: Presenter<any, any> | null;
    /**
     * The path the application lives under when it is not at the root of the site, like '/admin'.
     * Routes and links are relative to it, links outside it load another page. Set it before run().
     */
    basePath: string;
    /**
     * Composes document.title from the title of the page (Presenter.pageTitle()). By default
     * "Page – <the title in index.html>", without a page only the title in index.html.
     */
    formatTitle: (page: string | null) => string;
    /** Receives errors from navigation and from life cycle methods that nobody awaits. */
    onError: (error: unknown) => void;
    private scope;
    /** Versions of the tags of data, see invalidate(). */
    private versions;
    private started;
    private toastHost;
    /** The title of the page before the application changed it. */
    private baseTitle;
    /** Tells screen readers that another page is shown, see navigated(). */
    private announcer;
    /** The container holds services of the application. Services of the framework are added unless it has its own. */
    constructor(container?: Container);
    /** Creates the root presenter, routes the current URL and shows the result in the element. */
    run(root: Class<Presenter<any, any>>, element: Element): Promise<void>;
    /** A message with OK, as a dialog or, with `anchor`, as a popover at an element. */
    alert(message: Child, options?: MessageOptions, opener?: Component<any, any>): Promise<void>;
    /** A question with OK and Cancel. True for OK; Escape, a click outside or Cancel is false. */
    confirm(message: Child, options?: MessageOptions, opener?: Component<any, any>): Promise<boolean>;
    /** A question for a text. The text for OK, null for Cancel. */
    prompt(message: Child, options?: PromptOptions, opener?: Component<any, any>): Promise<string | null>;
    /** A dialog without buttons while something runs; close it by the returned handle. */
    showLoading(message?: Child, opener?: Component<any, any>): LoadingHandle;
    /**
     * The data with these tags have changed on the server: every resource with one of them loads again,
     * on whatever screen it is. Calls made at once go to the server as one batch.
     *   await this.api.call('task.update', …); this.app.invalidate('tasks');
     */
    invalidate(...tags: string[]): void;
    /**
     * A resource of the whole application, for services that hold data many screens show (users, projects).
     * It lives while the application runs. Components use Component.resource().
     */
    resource<T>(load: () => Promise<T>, options?: ResourceOptions): Resource<T>;
    /** A resource owned by the scope, reading the versions of its tags. Used by resource() and Component.resource(). */
    createResource<T>(scope: Scope, load: () => Promise<T>, options?: ResourceOptions): Resource<T>;
    private version;
    /**
     * Whether the components may leave: true without unsaved changes in them, otherwise the user decides.
     * Null means the whole application. The router and Component.cancel() ask through it.
     */
    mayLeave(leaving: Component<any, any>[] | null, opener?: Component<any, any>): Promise<boolean>;
    private opener;
    /** The title of the deepest presenter that has one. Reactive. */
    private pageTitle;
    /**
     * After a navigation has changed the page. Screen readers hear the title of the new page. When the focus
     * was on something the old page took away, it goes to the main heading of the new one; otherwise it stays
     * (a list with its detail would lose its place).
     */
    navigated(): void;
    /** Removes everything and stops routing. */
    stop(): void;
    /** Builds the whole tree of presenters again at the same URL, for example after a change of language. */
    restart(): Promise<void>;
    /** Closing or reloading the page, a link to another site: the browser asks with its own question. */
    private onBeforeUnload;
    /** A click on an ordinary link to this site becomes a navigation without a page reload. */
    private onClick;
}
