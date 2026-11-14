/**
 * Router: walks the tree of presenters from the root and gives each of them its part of the URL.
 * Only one navigation runs at a time. A newer one waits for it and the running one gives up at its next step.
 */
import { Presenter } from '../ui/presenter';
import type { LinkParams, Route } from '../ui/presenter';
import type { Application } from './application';
type AnyPresenter = Presenter<any, any>;
export declare class Router {
    private app;
    /** Path and query of the page that is shown. */
    readonly url: import("..").State<string>;
    private root;
    /** The position in history of the page that is shown, to return Back when the user stays. */
    private index;
    private returning;
    private running;
    /** Presenters created but not started: startup() runs once the router knows their route and parameters. */
    private pending;
    private queued;
    constructor(app: Application);
    /** Starts routing from the current URL of the browser. */
    start(root: AnyPresenter): Promise<void>;
    stop(): void;
    /** Goes to the URL. The promise is fulfilled when the navigation ends, even if it fails or a newer one replaces it. */
    navigate(url: string, options?: {
        replace?: boolean;
        refresh?: AnyPresenter;
    }): Promise<void>;
    /** Creates a URL, see Presenter.link(). */
    link(presenter: AnyPresenter, destination: string | Route, params?: LinkParams): string;
    /** Current values of the persistent parameters of the presenter and of the presenters above it. */
    private persistentOf;
    /** The parameters of the query that are persistent for the presenter or for a presenter above it. */
    private persistentQuery;
    /** The base path of the application without the slash at the end, see Application.basePath. */
    get base(): string;
    /** Whether the path belongs to the application, that is it lies under its base path. */
    owns(path: string): boolean;
    private onPopState;
    /** The user stays after Back or Forward: the browser goes back to the page that is shown. */
    private returnBack;
    private enqueue;
    private process;
    /**
     * Prepares the whole new state aside: runs actions and creates and starts new presenters and dialogs.
     * The page changes only at the end, so the old screen stays until the new one is ready.
     */
    private run;
    /** Remembers where the presenter is, to put it back when the user stays. */
    private snapshot;
    /** Keeps the dialog of the route when it is already open, otherwise prepares a new one and closes the old one. */
    private prepareDialog;
    private closeDialog;
    /**
     * Closes the routed dialogs of a presenter that is leaving, and of the presenters below it,
     * the topmost first, so that every `closed` learns about it.
     */
    private closeDialogsOf;
    /**
     * Leaves the URL of a dialog. Inside the application it goes back, so the Back button does not reopen the dialog.
     * After a direct link there is nowhere to go back, so the URL of the presenter replaces the URL of the dialog.
     */
    private leaveDialog;
    /** The old presenter is shut down while its view is still in the page. */
    private replaceChild;
}
export {};
