/**
 * Settings of the user that the application remembers: widths of columns, a collapsed menu, a chosen view.
 * The service is replaceable: the default keeps them in localStorage, an application can keep them on its server.
 */

import { state, untrack } from '../reactive/reactive';
import type { State } from '../reactive/reactive';

export abstract class Preferences {
  /** The remembered value, undefined when there is none. */
  abstract get<T>(key: string): T | undefined;
  /** Remembers the value. */
  abstract set(key: string, value: unknown): void;

  /** A state that starts with the remembered value (or `initial`) and remembers every change. */
  state<T>(key: string, initial: T): State<T> {
    const value = state<T>(this.get<T>(key) ?? initial);
    const set = value.set;
    value.set = next => {
      set(next);
      this.set(key, next);
    };
    value.update = change => value.set(change(untrack(value)));
    return value;
  }
}

/** Keeps the settings in localStorage as JSON, each under `prefix` + key. A blocked storage only forgets them. */
export class BrowserPreferences extends Preferences {
  constructor(private prefix = 'phlox.', private storage: () => Storage | null = () => globalThis.localStorage ?? null) {
    super();
  }

  get<T>(key: string): T | undefined {
    try {
      const saved = this.storage()?.getItem(this.prefix + key);
      return saved === null || saved === undefined ? undefined : (JSON.parse(saved) as T);
    } catch {
      return undefined;
    }
  }

  set(key: string, value: unknown): void {
    try {
      this.storage()?.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      // Not remembered, the application works on
    }
  }
}
