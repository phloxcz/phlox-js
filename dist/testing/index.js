import { Application } from "../application/application.js";
import { Container } from "../di/container.js";
// src/testing/index.ts
/**
* phlox-js/testing: helpers for tests of applications, with any runner that has a DOM (Vitest with jsdom…).
*
*   afterEach(cleanup);
*   const { element, go } = await bootApp(AppPresenter, { url: '/tasks', services });
*   await go('/tasks/5');
*   expect(element.querySelector('h1')!.textContent).toBe('Úkol 5');
*/
var running = [];
/** Starts the application at the URL. Errors go to `errors` instead of the console. */
async function bootApp(root, options = {}) {
	history.replaceState(null, "", options.url ?? "/");
	const element = document.createElement("main");
	document.body.append(element);
	const app = new Application(options.services ?? new Container());
	if (options.basePath) app.basePath = options.basePath;
	const errors = [];
	app.onError = (error) => errors.push(error);
	running.push(app);
	await app.run(root, element);
	return {
		app,
		element,
		errors,
		go: (url) => app.router.navigate(url)
	};
}
/** Stops every application started by bootApp() and empties the page. For afterEach(). */
function cleanup() {
	for (const app of running.splice(0)) app.stop();
	document.body.replaceChildren();
}
/** Lets timers, microtasks and browser events happen (a debounce, popstate…). */
function tick(ms = 20) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
/** Waits until the condition holds, e.g. until data from a mock server are shown. */
async function until(condition, timeout = 2e3) {
	const end = Date.now() + timeout;
	while (!condition()) {
		if (Date.now() > end) throw new Error("The condition did not hold in time.");
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}
/** Types into a field as the user would: the value and an input event. */
function type(field, text) {
	field.value = text;
	field.dispatchEvent(new Event("input", { bubbles: true }));
}
/** Presses a key on an element: `press(input, 'Enter')`. */
function press(element, key, options = {}) {
	element.dispatchEvent(new KeyboardEvent("keydown", {
		key,
		bubbles: true,
		cancelable: true,
		...options
	}));
}
export { bootApp, cleanup, press, tick, type, until };
