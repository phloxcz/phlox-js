/**
 * Data from the server that follow the state they depend on, e.g. the tasks of the chosen tab.
 * Created by Component.resource(), so the loading ends with the component and errors reach app.onError.
 */
import type { Accessor } from '../reactive/reactive';
export interface ResourceOptions {
    /**
     * What data the resource shows, e.g. ['tasks']. After app.invalidate('tasks') it loads again,
     * wherever it is on the screen.
     */
    tags?: string[];
}
export interface Resource<T> extends Accessor<T | undefined> {
    /** True while a load runs. The last value stays readable meanwhile. */
    readonly loading: Accessor<boolean>;
    /** Loads again with the same state, e.g. after a change on the server. */
    reload(): Promise<void>;
    /** Fulfilled when the load running now ends, also when it fails. Await it in startup(). */
    ready(): Promise<void>;
}
/**
 * Calls `load` now and again whenever state it read before its first await changes.
 * An older answer never overwrites a newer one. A failure goes to `onError` and keeps the last value.
 */
export declare function resource<T>(load: () => Promise<T>, onError: (error: unknown) => void): Resource<T>;
