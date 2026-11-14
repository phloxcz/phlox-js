/**
 * Reactive core: state, computed, effect and the scopes that clean them up.
 * The algorithm is described in docs/design.md (section "Reaktivní jádro").
 */
export type Accessor<T> = () => T;
export interface State<T> extends Accessor<T> {
    set(value: T): void;
    update(change: (value: T) => T): void;
}
/** Owns effects, computed values and cleanups. Disposing it disposes everything inside. */
export declare class Scope {
    private parent;
    readonly depth: number;
    disposed: boolean;
    private children;
    private cleanups;
    private values;
    constructor(parent?: Scope | null);
    /** Makes a value available to everything created inside this scope. */
    provide(key: unknown, value: unknown): void;
    /** Finds a value provided by this scope or by the nearest scope above it. */
    find<T>(key: unknown): T | undefined;
    run<T>(fn: () => T): T;
    onCleanup(fn: () => void): void;
    /** A failing cleanup is only logged, it must not stop the others. */
    protected clear(): void;
    dispose(): void;
}
export declare function state<T>(initial: T): State<T>;
/** A derived value. It is computed lazily and recomputed only when its sources really changed. */
export declare function computed<T>(fn: Accessor<T>): Accessor<T>;
/** Runs now and again after every change of what it read. It may return a cleanup. Returns a dispose function. */
export declare function effect(fn: () => void | (() => void)): () => void;
/** Applies several changes at once, effects run after the last one. */
export declare function batch<T>(fn: () => T): T;
/** Reads without subscribing. */
export declare function untrack<T>(fn: () => T): T;
/** The scope that owns whatever is being created right now. */
export declare function getScope(): Scope | null;
/** Registers a cleanup in the current scope. Outside of a scope there is nothing that could call it. */
export declare function onCleanup(fn: () => void): void;
