/**
 * Data from the server that follow the state they depend on, e.g. the tasks of the chosen tab.
 * Created by Component.resource(), so the loading ends with the component and errors reach app.onError.
 */

import { batch, effect, state, untrack } from '../reactive/reactive';
import type { Accessor } from '../reactive/reactive';

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
export function resource<T>(load: () => Promise<T>, onError: (error: unknown) => void): Resource<T> {
  const value = state<T | undefined>(undefined);
  const loading = state(false);
  let last = 0;
  let current: Promise<void> = Promise.resolve();

  const run = (): Promise<void> => {
    const id = ++last;
    let promise: Promise<T>;
    try {
      promise = load();
    } catch (error) {
      promise = Promise.reject(error);
    }
    untrack(() => loading.set(true));
    current = promise.then(
      result => {
        if (id === last) batch(() => {
          value.set(result);
          loading.set(false);
        });
      },
      error => {
        if (id !== last) return;
        loading.set(false);
        onError(error);
      },
    );
    return current;
  };

  effect(() => void run());
  return Object.assign(() => value(), {
    loading: () => loading(),
    reload: () => untrack(run),
    ready: () => current,
  });
}
