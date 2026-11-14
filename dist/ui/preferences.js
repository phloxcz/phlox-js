import { state, untrack } from "../reactive/reactive.js";
// src/ui/preferences.ts
/**
* Settings of the user that the application remembers: widths of columns, a collapsed menu, a chosen view.
* The service is replaceable: the default keeps them in localStorage, an application can keep them on its server.
*/
var Preferences = class {
	/** A state that starts with the remembered value (or `initial`) and remembers every change. */
	state(key, initial) {
		const value = state(this.get(key) ?? initial);
		const set = value.set;
		value.set = (next) => {
			set(next);
			this.set(key, next);
		};
		value.update = (change) => value.set(change(untrack(value)));
		return value;
	}
};
/** Keeps the settings in localStorage as JSON, each under `prefix` + key. A blocked storage only forgets them. */
var BrowserPreferences = class extends Preferences {
	prefix;
	storage;
	constructor(prefix = "phlox.", storage = () => globalThis.localStorage ?? null) {
		super();
		this.prefix = prefix;
		this.storage = storage;
	}
	get(key) {
		try {
			const saved = this.storage()?.getItem(this.prefix + key);
			return saved === null || saved === void 0 ? void 0 : JSON.parse(saved);
		} catch {
			return;
		}
	}
	set(key, value) {
		try {
			this.storage()?.setItem(this.prefix + key, JSON.stringify(value));
		} catch {}
	}
};
export { BrowserPreferences, Preferences };
