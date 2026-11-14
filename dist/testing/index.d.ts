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
/** Starts the application at the URL. Errors go to `errors` instead of the console. */
export declare function bootApp(root: Class<Presenter<any, any>>, options?: BootOptions): Promise<TestApp>;
/** Stops every application started by bootApp() and empties the page. For afterEach(). */
export declare function cleanup(): void;
/** Lets timers, microtasks and browser events happen (a debounce, popstate…). */
export declare function tick(ms?: number): Promise<void>;
/** Waits until the condition holds, e.g. until data from a mock server are shown. */
export declare function until(condition: () => boolean, timeout?: number): Promise<void>;
/** Types into a field as the user would: the value and an input event. */
export declare function type(field: HTMLInputElement | HTMLTextAreaElement, text: string): void;
/** Presses a key on an element: `press(input, 'Enter')`. */
export declare function press(element: Element, key: string, options?: KeyboardEventInit): void;
