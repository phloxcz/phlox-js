import { describe, expect, test, vi } from 'vitest';
import { Scope, batch, computed, effect, onCleanup, state, untrack } from '../src/reactive';

describe('state', () => {
  test('reads and writes', () => {
    const count = state(1);
    count.set(2);
    expect(count()).toBe(2);
    count.update(value => value + 1);
    expect(count()).toBe(3);
  });

  test('the same value does not notify', () => {
    const count = state(1);
    const run = vi.fn(() => { count(); });
    effect(run);
    count.set(1);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('computed', () => {
  test('is lazy and cached', () => {
    const count = state(1);
    const fn = vi.fn(() => count() * 2);
    const double = computed(fn);
    expect(fn).not.toHaveBeenCalled();
    expect(double()).toBe(2);
    expect(double()).toBe(2);
    expect(fn).toHaveBeenCalledTimes(1);
    count.set(2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(double()).toBe(4);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('diamond: one run and never an inconsistent value', () => {
    const a = state(1);
    const b = computed(() => a() + 1);
    const c = computed(() => a() * 10);
    const dFn = vi.fn(() => b() + c());
    const d = computed(dFn);
    const seen: number[] = [];
    effect(() => { seen.push(d()); });

    a.set(2);

    expect(seen).toEqual([12, 23]);
    expect(dFn).toHaveBeenCalledTimes(2);
  });

  test('deep diamond with an effect reading both sides', () => {
    const a = state(1);
    const left = computed(() => computed(() => a() + 1)());
    const right = computed(() => a() + 1);
    const seen: boolean[] = [];
    effect(() => { seen.push(left() === right()); });
    a.set(5);
    a.set(6);
    expect(seen).toEqual([true, true, true]);
  });

  test('an unchanged result stops the update', () => {
    const count = state(1);
    const even = computed(() => count() % 2 === 0);
    const run = vi.fn(() => { even(); });
    effect(run);
    count.set(3);
    expect(run).toHaveBeenCalledTimes(1);
    count.set(4);
    expect(run).toHaveBeenCalledTimes(2);
  });

  test('a dependency that is no longer read does not notify', () => {
    const useA = state(true);
    const a = state(1);
    const b = state(2);
    const fn = vi.fn(() => (useA() ? a() : b()));
    const value = computed(fn);
    effect(() => { value(); });

    useA.set(false);
    a.set(10);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(value()).toBe(2);
  });

  test('a stale branch is not evaluated', () => {
    const user = state<{ name: string } | null>({ name: 'A' });
    const name = computed(() => user()!.name);
    const seen: string[] = [];
    const hasUser = computed(() => user() !== null);
    effect(() => { seen.push(hasUser() ? name() : 'none'); });
    expect(() => user.set(null)).not.toThrow();
    expect(seen).toEqual(['A', 'none']);
  });

  test('an error is rethrown to readers and the computed recovers', () => {
    const value = state(0);
    const checked = computed(() => {
      if (value() < 0) throw new Error('negative');
      return value();
    });
    const seen: unknown[] = [];
    effect(() => {
      try { seen.push(checked()); } catch (error) { seen.push((error as Error).message); }
    });
    value.set(-1);
    expect(() => checked()).toThrow('negative');
    value.set(5);
    expect(checked()).toBe(5);
    expect(seen).toEqual([0, 'negative', 5]);
  });

  test('a cycle is reported', () => {
    const a: () => number = computed(() => a() + 1);
    expect(() => a()).toThrow('Circular');
  });

  test('must not change state', () => {
    const count = state(0);
    const wrong = computed(() => { count.set(1); return 1; });
    expect(() => wrong()).toThrow('must not change state');
  });

  test('after its scope is disposed it still returns a fresh value without subscribing', () => {
    const count = state(1);
    const fn = vi.fn(() => count() * 2);
    const scope = new Scope(null);
    const double = scope.run(() => computed(fn));
    expect(double()).toBe(2);
    scope.dispose();
    count.set(2);
    expect(double()).toBe(4);
  });
});

describe('effect', () => {
  test('reruns on change and can be disposed', () => {
    const count = state(1);
    const seen: number[] = [];
    const dispose = effect(() => { seen.push(count()); });
    count.set(2);
    dispose();
    count.set(3);
    expect(seen).toEqual([1, 2]);
  });

  test('batch runs effects once, after the last change', () => {
    const a = state(1);
    const b = state(2);
    const seen: number[] = [];
    effect(() => { seen.push(a() + b()); });
    batch(() => {
      a.set(10);
      b.set(20);
      expect(seen).toEqual([3]);
    });
    expect(seen).toEqual([3, 30]);
  });

  test('untrack does not subscribe', () => {
    const a = state(1);
    const b = state(1);
    const run = vi.fn(() => { a(); untrack(b); });
    effect(run);
    b.set(2);
    expect(run).toHaveBeenCalledTimes(1);
    a.set(2);
    expect(run).toHaveBeenCalledTimes(2);
  });

  test('state changed by an effect is applied', () => {
    const a = state(1);
    const b = state(0);
    effect(() => { b.set(a() * 2); });
    a.set(2);
    expect(b()).toBe(4);
  });

  test('an effect changing its own dependency runs again, the change is not lost', () => {
    const a = state(0);
    const seen: number[] = [];
    effect(() => {
      seen.push(a());
      if (a() < 2) a.set(a() + 1);
    });
    expect(seen).toEqual([0, 1, 2]);
    a.set(0);
    expect(seen).toEqual([0, 1, 2, 0, 1, 2]);
  });

  test('an endless loop is stopped', () => {
    const a = state(0);
    const dispose = effect(() => {
      if (a() > 0) a.set(a() + 1);
    });
    expect(() => a.set(1)).toThrow('keep changing');
    dispose();
  });

  test('a failing effect does not stop the others and the error reaches the caller', () => {
    const a = state(0);
    const seen: number[] = [];
    effect(() => { if (a() === 1) throw new Error('boom'); });
    effect(() => { seen.push(a()); });
    expect(() => a.set(1)).toThrow('boom');
    expect(seen).toEqual([0, 1]);
    a.set(2);
    expect(seen).toEqual([0, 1, 2]);
  });

  test('a child effect is disposed before its parent reruns (zombie child)', () => {
    const user = state<{ name: string } | null>({ name: 'A' });
    const seen: string[] = [];
    effect(() => {
      if (user()) effect(() => { seen.push(user()!.name); });
    });
    expect(() => user.set(null)).not.toThrow();
    expect(seen).toEqual(['A']);
  });

  test('nested effects do not pile up', () => {
    const outer = state(0);
    const inner = state(0);
    const run = vi.fn(() => { inner(); });
    effect(() => {
      outer();
      effect(run);
    });
    outer.set(1);
    outer.set(2);
    run.mockClear();
    inner.set(1);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('cleanup', () => {
  test('runs before a rerun and on dispose, in reverse order', () => {
    const count = state(0);
    const log: string[] = [];
    const dispose = effect(() => {
      const value = count();
      onCleanup(() => log.push(`first ${value}`));
      return () => log.push(`returned ${value}`);
    });
    count.set(1);
    expect(log).toEqual(['returned 0', 'first 0']);
    dispose();
    expect(log).toEqual(['returned 0', 'first 0', 'returned 1', 'first 1']);
  });

  test('a scope disposes everything inside, recursively', () => {
    const count = state(0);
    const seen: number[] = [];
    const log: string[] = [];
    const scope = new Scope(null);
    scope.run(() => {
      onCleanup(() => log.push('outer'));
      new Scope().run(() => {
        onCleanup(() => log.push('inner'));
        effect(() => { seen.push(count()); });
      });
    });
    scope.dispose();
    count.set(1);
    expect(seen).toEqual([0]);
    expect(log).toEqual(['inner', 'outer']);
  });

  test('a failing cleanup does not stop the others', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log: string[] = [];
    const scope = new Scope(null);
    scope.run(() => {
      onCleanup(() => log.push('runs'));
      onCleanup(() => { throw new Error('boom'); });
    });
    scope.dispose();
    expect(log).toEqual(['runs']);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  test('a disposed scope cannot be used again', () => {
    const scope = new Scope(null);
    scope.dispose();
    expect(() => scope.run(() => 1)).toThrow('disposed');
  });
});
