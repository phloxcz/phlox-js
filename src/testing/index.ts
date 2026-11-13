/**
 * phlox-js/testing: helpers for tests of applications, with any runner that has a DOM (Vitest with jsdom…).
 *
 *   afterEach(cleanup);
 *   const { element, go } = await bootApp(AppPresenter, { url: '/tasks', services });
 *   await go('/tasks/5');
 *   expect(element.querySelector('h1')!.textContent).toBe('Úkol 5');
 */

import { Application } from '../application/application';
import { Container } from '../di/container';
import type { Class } from '../di/container';
import type { Presenter } from '../ui/presenter';

export interface BootOptions {
  /** The URL the application starts at, '/' by default. */
  url?: string;
  /** The services, typically the real ones with fakes added over them. */
  services?: Container;
  /** See Application.basePath. */
  basePath?: string;
}

export interface TestApp {
  app: Application;
  /** The element the application is rendered into, in document.body. */
  element: HTMLElement;
  /** Errors the application reported (app.onError); a test expects them empty, or checks them. */
  errors: unknown[];
  /** Goes to a URL and waits for the navigation. */
  go(url: string): Promise<void>;
}

const running: Application[] = [];

/** Starts the application at the URL. Errors go to `errors` instead of the console. */
export async function bootApp(root: Class<Presenter<any, any>>, options: BootOptions = {}): Promise<TestApp> {
  history.replaceState(null, '', options.url ?? '/');
  const element = document.createElement('main');
  document.body.append(element);
  const app = new Application(options.services ?? new Container());
  if (options.basePath) app.basePath = options.basePath;
  const errors: unknown[] = [];
  app.onError = error => errors.push(error);
  running.push(app);
  await app.run(root, element);
  return { app, element, errors, go: url => app.router.navigate(url) };
}

/** Stops every application started by bootApp() and empties the page. For afterEach(). */
export function cleanup(): void {
  for (const app of running.splice(0)) app.stop();
  document.body.replaceChildren();
}

/** Lets timers, microtasks and browser events happen (a debounce, popstate…). */
export function tick(ms = 20): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Waits until the condition holds, e.g. until data from a mock server are shown. */
export async function until(condition: () => boolean, timeout = 2000): Promise<void> {
  const end = Date.now() + timeout;
  while (!condition()) {
    if (Date.now() > end) throw new Error('The condition did not hold in time.');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/** Types into a field as the user would: the value and an input event. */
export function type(field: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  field.value = text;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Presses a key on an element: `press(input, 'Enter')`. */
export function press(element: Element, key: string, options: KeyboardEventInit = {}): void {
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
}
