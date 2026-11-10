/**
 * Reactive core: state, computed, effect and the scopes that clean them up.
 * The algorithm is described in docs/design.md (section "Reaktivní jádro").
 */

export type Accessor<T> = () => T;

export interface State<T> extends Accessor<T> {
  set(value: T): void;
  update(change: (value: T) => T): void;
}

const CLEAN = 0;
const CHECK = 1; // a computed somewhere above may have changed
const DIRTY = 2; // a direct source has changed

const MAX_FLUSH_PASSES = 1000;

interface Source {
  observers: Set<Observer>;
  refresh?(): void;
}

let currentScope: Scope | null = null;
let tracking: Observer | null = null;
let queue: Effect[] = [];
let flushing = false;
let batchDepth = 0;

/** Owns effects, computed values and cleanups. Disposing it disposes everything inside. */
export class Scope {
  readonly depth: number;
  disposed = false;
  private children = new Set<Scope>();
  private cleanups: (() => void)[] = [];
  private values: Map<unknown, unknown> | null = null;

  constructor(private parent: Scope | null = currentScope) {
    this.depth = parent ? parent.depth + 1 : 0;
    parent?.children.add(this);
  }

  /** Makes a value available to everything created inside this scope. */
  provide(key: unknown, value: unknown): void {
    (this.values ??= new Map()).set(key, value);
  }

  /** Finds a value provided by this scope or by the nearest scope above it. */
  find<T>(key: unknown): T | undefined {
    return this.values?.has(key) ? (this.values.get(key) as T) : this.parent?.find<T>(key);
  }

  run<T>(fn: () => T): T {
    if (this.disposed) throw new Error('Cannot run in a disposed scope.');
    const previous = currentScope;
    currentScope = this;
    try {
      return fn();
    } finally {
      currentScope = previous;
    }
  }

  onCleanup(fn: () => void): void {
    this.cleanups.push(fn);
  }

  /** A failing cleanup is only logged, it must not stop the others. */
  protected clear(): void {
    for (const child of [...this.children]) child.dispose();
    for (const cleanup of this.cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch (error) {
        console.error(error);
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.parent?.children.delete(this);
  }
}

abstract class Observer extends Scope {
  status = DIRTY;
  sources = new Set<Source>();

  protected abstract recompute(): void;
  protected abstract notify(): void;

  mark(status: number): void {
    if (this.status >= status) return;
    const wasClean = this.status === CLEAN;
    this.status = status;
    if (wasClean) this.notify();
  }

  /** Brings this observer up to date, sources are read in the order they were tracked. */
  refresh(): void {
    if (this.status === CHECK) {
      for (const source of this.sources) {
        source.refresh?.();
        if ((this.status as number) === DIRTY) break;
      }
      if (this.status === CHECK) this.status = CLEAN;
    }
    if (this.status === DIRTY) this.recompute();
  }

  protected execute<T>(fn: () => T): T {
    this.clear();
    this.unlink();
    // Clean before the run, so a change made during it is not lost
    this.status = CLEAN;
    const previous = tracking;
    tracking = this;
    try {
      return this.run(fn);
    } finally {
      tracking = previous;
    }
  }

  private unlink(): void {
    for (const source of this.sources) source.observers.delete(this);
    this.sources.clear();
  }

  override dispose(): void {
    super.dispose();
    this.unlink();
  }
}

class Computed<T> extends Observer implements Source {
  observers = new Set<Observer>();
  private value: T | undefined;
  private error: unknown;
  private failed = false;
  private computed = false;
  private running = false;

  constructor(private fn: Accessor<T>) {
    super();
  }

  read(): T {
    if (this.disposed) return untrack(this.fn);
    if (this.running) throw new Error('Circular dependency in computed.');
    this.refresh();
    track(this);
    if (this.failed) throw this.error;
    return this.value as T;
  }

  protected recompute(): void {
    this.running = true;
    let changed: boolean;
    try {
      const value = this.execute(this.fn);
      changed = this.failed || !this.computed || !Object.is(this.value, value);
      this.value = value;
      this.failed = false;
    } catch (error) {
      changed = true;
      this.error = error;
      this.failed = true;
    } finally {
      this.running = false;
    }
    this.computed = true;
    if (changed) markObservers(this, DIRTY);
  }

  protected notify(): void {
    markObservers(this, CHECK);
  }
}

class Effect extends Observer {
  constructor(private fn: () => void | (() => void)) {
    super();
  }

  protected recompute(): void {
    const cleanup = this.execute(this.fn);
    if (cleanup) this.onCleanup(cleanup);
  }

  protected notify(): void {
    queue.push(this);
  }
}

function track(source: Source): void {
  if (!tracking || tracking.disposed) return;
  tracking.sources.add(source);
  source.observers.add(tracking);
}

function markObservers(source: Source, status: number): void {
  for (const observer of source.observers) observer.mark(status);
}

/** Runs queued effects, parents first, so a child never runs on data its parent is about to remove. */
function flush(): void {
  if (flushing || batchDepth > 0) return;
  flushing = true;
  const errors: unknown[] = [];
  try {
    for (let pass = 0; queue.length > 0; pass++) {
      if (pass >= MAX_FLUSH_PASSES) {
        queue = [];
        throw new Error('Effects keep changing state they depend on.');
      }
      const effects = queue.sort((a, b) => a.depth - b.depth);
      queue = [];
      for (const effect of effects) {
        if (effect.disposed) continue;
        try {
          effect.refresh();
        } catch (error) {
          errors.push(error);
        }
      }
    }
  } finally {
    flushing = false;
  }
  if (errors.length > 0) throw errors[0];
}

export function state<T>(initial: T): State<T> {
  let value = initial;
  const source: Source = { observers: new Set() };
  const read = (() => {
    track(source);
    return value;
  }) as State<T>;
  read.set = next => {
    if (tracking instanceof Computed) throw new Error('A computed must not change state.');
    if (Object.is(value, next)) return;
    value = next;
    markObservers(source, DIRTY);
    flush();
  };
  read.update = change => read.set(change(untrack(() => value)));
  return read;
}

/** A derived value. It is computed lazily and recomputed only when its sources really changed. */
export function computed<T>(fn: Accessor<T>): Accessor<T> {
  const node = new Computed(fn);
  return () => node.read();
}

/** Runs now and again after every change of what it read. It may return a cleanup. Returns a dispose function. */
export function effect(fn: () => void | (() => void)): () => void {
  const node = new Effect(fn);
  // In a batch, so that an effect changing state does not rerun inside its own first run
  batch(() => node.refresh());
  return () => node.dispose();
}

/** Applies several changes at once, effects run after the last one. */
export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    flush();
  }
}

/** Reads without subscribing. */
export function untrack<T>(fn: () => T): T {
  const previous = tracking;
  tracking = null;
  try {
    return fn();
  } finally {
    tracking = previous;
  }
}

/** The scope that owns whatever is being created right now. */
export function getScope(): Scope | null {
  return currentScope;
}

/** Registers a cleanup in the current scope. Outside of a scope there is nothing that could call it. */
export function onCleanup(fn: () => void): void {
  currentScope?.onCleanup(fn);
}
