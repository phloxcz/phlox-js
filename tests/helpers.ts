import { afterEach } from 'vitest';
import { Container } from '../src/index';
import type { Class, Presenter } from '../src/index';
import { bootApp, cleanup, tick as wait, until } from '../src/testing/index';

// The tests of the framework use the same helpers as tests of applications, see phlox-js/testing
afterEach(cleanup);

/** Starts an application at the given URL. Errors reported to the application are collected. */
export function boot(root: Class<Presenter<any, any>>, url = '/', container = new Container()) {
  return bootApp(root, { url, services: container });
}

/** Lets microtasks and browser events (popstate) happen. */
export function tick(): Promise<void> {
  return wait();
}

export { until };

/** A promise resolved from outside, for slow operations in tests. */
export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

/** history.back() and the navigation it starts. Waits for popstate, which jsdom sends later when it is busy. */
export async function goBack(): Promise<void> {
  const popped = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }));
  history.back();
  await popped;
  await tick();
}
