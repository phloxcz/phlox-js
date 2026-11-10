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
