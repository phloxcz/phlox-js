import { batch, effect, state, untrack } from "../reactive/reactive.js";
// src/ui/resource.ts
/**
* Data from the server that follow the state they depend on, e.g. the tasks of the chosen tab.
* Created by Component.resource(), so the loading ends with the component and errors reach app.onError.
*/
/**
* Calls `load` now and again whenever state it read before its first await changes.
* An older answer never overwrites a newer one. A failure goes to `onError` and keeps the last value.
*/
function resource(load, onError) {
	const value = state(void 0);
	const loading = state(false);
	let last = 0;
	let current = Promise.resolve();
	const run = () => {
		const id = ++last;
		let promise;
		try {
			promise = load();
		} catch (error) {
			promise = Promise.reject(error);
		}
		untrack(() => loading.set(true));
		current = promise.then((result) => {
			if (id === last) batch(() => {
				value.set(result);
				loading.set(false);
			});
		}, (error) => {
			if (id !== last) return;
			loading.set(false);
			onError(error);
		});
		return current;
	};
	effect(() => void run());
	return Object.assign(() => value(), {
		loading: () => loading(),
		reload: () => untrack(run),
		ready: () => current
	});
}
export { resource };
