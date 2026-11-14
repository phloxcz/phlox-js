/**
 * Settings of the user that the application remembers: widths of columns, a collapsed menu, a chosen view.
 * The service is replaceable: the default keeps them in localStorage, an application can keep them on its server.
 */
import type { State } from '../reactive/reactive';
export declare abstract class Preferences {
    /** The remembered value, undefined when there is none. */
    abstract get<T>(key: string): T | undefined;
    /** Remembers the value. */
    abstract set(key: string, value: unknown): void;
    /** A state that starts with the remembered value (or `initial`) and remembers every change. */
    state<T>(key: string, initial: T): State<T>;
}
/** Keeps the settings in localStorage as JSON, each under `prefix` + key. A blocked storage only forgets them. */
export declare class BrowserPreferences extends Preferences {
    private prefix;
    private storage;
    constructor(prefix?: string, storage?: () => Storage | null);
    get<T>(key: string): T | undefined;
    set(key: string, value: unknown): void;
}
