import { afterEach } from 'vitest';
import { Application, Container } from '../src/index';
import type { Class, Presenter } from '../src/index';

const running: Application[] = [];

afterEach(() => {
  for (const app of running.splice(0)) app.stop();
  document.body.replaceChildren();
});

/** Starts an application at the given URL. Errors reported to the application are collected. */
export async function boot(root: Class<Presenter<any, any>>, url = '/', container = new Container()) {
  history.replaceState(null, '', url);
  const element = document.createElement('main');
  document.body.append(element);
  const app = new Application(container);
  const errors: unknown[] = [];
  app.onError = error => errors.push(error);
  running.push(app);
  await app.run(root, element);
  return { app, element, errors, go: (to: string) => app.router.navigate(to) };
}

/** Lets microtasks and browser events (popstate) happen. */
export function tick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 20));
}

/** A promise resolved from outside, for slow operations in tests. */
export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Waits until the condition holds, for things that take a browser event or two, e.g. history.back(). */
export async function until(condition: () => boolean, timeout = 2000): Promise<void> {
  const end = Date.now() + timeout;
  while (!condition()) {
    if (Date.now() > end) throw new Error('The condition did not hold in time.');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/** history.back() and the navigation it starts. Waits for popstate, which jsdom sends later when it is busy. */
export async function goBack(): Promise<void> {
  const popped = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }));
  history.back();
  await popped;
  await tick();
}
