import { state, untrack } from "../reactive/reactive.js";
import { online } from "./online.js";
import { RpcError, RpcErrorCode } from "./rpc.js";
// src/net/offline.ts
/**
* Working offline: results of reading methods are kept, writing methods go to a queue while there is
* no network and are sent when it is back. Generic, the application only says which methods are which:
*
*   const offline = new RpcOffline<RpcMethods>(new IndexedDbStore('helpdesk'), {
*     reads: { 'task.read': {}, 'task.list': { offline: (params, cache) => … } },
*     writes: { 'task.update': { apply: (params, cache) => …, version: … } },
*   });
*   services.add(new RpcApi('/rpc', { offline }));
*
* Collisions are not merged. When a record changed on the server after it was saved offline,
* the change waits in `conflicts` and the user decides: send it anyway, or drop it.
*/
var isNetworkError = (error) => error instanceof RpcError && error.code === RpcErrorCode.Network;
var RpcOffline = class {
	store;
	rules;
	scope;
	/** Changes waiting to be sent. */
	pending = state([]);
	/** Changes of records that changed on the server meanwhile; resolve() decides each. */
	conflicts = state([]);
	/** Changes the server refused (validation, permission); retry() or drop(). */
	failed = state([]);
	syncing = state(false);
	/** When the data for offline were last downloaded, ISO, null when never. */
	downloaded = state(null);
	send = null;
	listeners = [];
	loaded = null;
	counter = 0;
	/**
	* @param scope the owner of the data, e.g. `() => String(user.getId())`: data and changes of one user
	*              are never shown to or sent for another one
	*/
	constructor(store, rules, scope = () => "") {
		this.store = store;
		this.rules = rules;
		this.scope = scope;
		if (typeof window !== "undefined") window.addEventListener("online", () => void this.sync());
	}
	/** Whether the client should ask this object about the method. */
	handles(method) {
		return method in (this.rules.reads ?? {}) || method in (this.rules.writes ?? {});
	}
	/** Called by RpcClient with its way of calling the server. */
	attach(send) {
		this.send = send;
	}
	/** After changes were sent: lists can load again, e.g. app.invalidate('tasks'). Returns a function that stops it. */
	onSynced(listener) {
		this.listeners.push(listener);
		return () => {
			this.listeners = this.listeners.filter((other) => other !== listener);
		};
	}
	/** A call of a method in the rules, from RpcClient. */
	async call(method, params) {
		await this.load();
		const read = this.rules.reads?.[method];
		if (read) return this.read(method, params, read);
		const write = this.rules.writes[method];
		if (untrack(online)) try {
			return await this.send(method, params);
		} catch (error) {
			if (!isNetworkError(error)) throw error;
		}
		return this.queue(method, params, write);
	}
	/**
	* Downloads data for working offline: each call is made and kept, e.g. the tasks of the chosen project
	* and the detail of each of them. Calls made at once go as one batch.
	*/
	async download(calls) {
		await this.load();
		await Promise.all(calls.map(async ([method, params]) => this.cache.set(method, params, await this.send(method, params))));
		const now = (/* @__PURE__ */ new Date()).toISOString();
		this.downloaded.set(now);
		await this.store.set(this.key("meta:downloaded"), now);
	}
	/** Sends the waiting changes one by one. Changes of records changed meanwhile go to `conflicts`. */
	async sync() {
		await this.load();
		if (untrack(this.syncing) || !this.send || !untrack(online)) return;
		this.syncing.set(true);
		let sent = 0;
		const run = async () => {
			await this.load(true);
			for (const change of untrack(this.pending)) {
				const rule = this.rules.writes[change.method];
				if (rule?.current && change.version !== void 0) {
					if (await rule.current(change.params, (method, params) => this.send(method, params)) !== change.version) {
						await this.move(change, "conflicts");
						continue;
					}
				}
				if (!await this.deliver(change)) break;
				sent++;
			}
		};
		try {
			const locks = typeof navigator === "undefined" ? void 0 : navigator.locks;
			if (locks) await locks.request(this.key("sync"), run);
			else await run();
		} finally {
			this.syncing.set(false);
		}
		if (sent) for (const listener of this.listeners) listener();
	}
	/** The user decided about a change of a record changed meanwhile: send it anyway, or drop it. */
	async resolve(change, decision) {
		this.conflicts.update((list) => list.filter((other) => other.key !== change.key));
		if (decision === "drop") {
			await this.store.delete(this.key(`change:${change.key}`));
			return;
		}
		if (await this.deliver(change)) for (const listener of this.listeners) listener();
	}
	/** Sends a refused change again, e.g. after the user fixed what the server refused. */
	async retry(change) {
		this.failed.update((list) => list.filter((other) => other.key !== change.key));
		if (await this.deliver(change)) for (const listener of this.listeners) listener();
	}
	/** Drops a refused change. */
	async drop(change) {
		this.failed.update((list) => list.filter((other) => other.key !== change.key));
		await this.store.delete(this.key(`change:${change.key}`));
	}
	/** Forgets the kept data of the current user (not the changes waiting to be sent). */
	async clearCache() {
		for (const [key] of await this.store.entries(this.key("read:"))) await this.store.delete(key);
		this.downloaded.set(null);
		await this.store.delete(this.key("meta:downloaded"));
	}
	/** The kept data, also for code of the application. */
	cache = {
		get: async (method, params) => (await this.store.get(this.readKey(method, params)))?.value,
		set: (method, params, value) => this.store.set(this.readKey(method, params), {
			params: params ?? {},
			value
		}),
		all: async (method) => (await this.store.entries(this.key(`read:${method}:`))).map(([, entry]) => entry)
	};
	async read(method, params, rule) {
		if (untrack(online)) try {
			const result = await this.send(method, params);
			await this.store.set(this.readKey(method, params), {
				params: params ?? {},
				value: result
			});
			return result;
		} catch (error) {
			if (!isNetworkError(error)) throw error;
		}
		const kept = await this.store.get(this.readKey(method, params));
		if (kept) return kept.value;
		const computed = await rule.offline?.(params, this.cache);
		if (computed !== void 0) return computed;
		throw new RpcError(RpcErrorCode.Network, "Offline: these data were not prepared for working offline.", {}, method);
	}
	async queue(method, params, rule) {
		const version = await rule.version?.(params, this.cache);
		const change = {
			key: `${Date.now().toString(36).padStart(10, "0")}-${(++this.counter).toString(36).padStart(4, "0")}`,
			method,
			params,
			made: (/* @__PURE__ */ new Date()).toISOString(),
			...version !== void 0 ? { version } : {},
			title: await rule.describe?.(params, this.cache) ?? method
		};
		const result = await rule.apply(params, this.cache);
		await this.store.set(this.key(`change:${change.key}`), change);
		this.pending.update((list) => [...list, change]);
		return result;
	}
	/** Sends one change. False when the network is gone again or the user is not signed in: the rest waits. */
	async deliver(change) {
		try {
			await this.send(change.method, change.params);
		} catch (error) {
			if (isNetworkError(error) || error instanceof RpcError && error.code === RpcErrorCode.Unauthorized) return false;
			await this.move({
				...change,
				error: error instanceof Error ? error.message : String(error)
			}, "failed");
			return true;
		}
		await this.store.delete(this.key(`change:${change.key}`));
		this.pending.update((list) => list.filter((other) => other.key !== change.key));
		return true;
	}
	async move(change, to) {
		this.pending.update((list) => list.filter((other) => other.key !== change.key));
		this[to].update((list) => [...list, change]);
		await this.store.set(this.key(`change:${change.key}`), {
			...change,
			state: to
		});
	}
	/** Loads the waiting changes of the current user, once per user. */
	load(again = false) {
		const scope = this.scope();
		if (this.loaded && this.loadedScope === scope && !again) return this.loaded;
		this.loadedScope = scope;
		this.loaded = (async () => {
			const changes = (await this.store.entries(this.key("change:"))).map(([, change]) => change);
			this.pending.set(changes.filter((change) => !change.state));
			this.conflicts.set(changes.filter((change) => change.state === "conflicts"));
			this.failed.set(changes.filter((change) => change.state === "failed"));
			this.downloaded.set(await this.store.get(this.key("meta:downloaded")) ?? null);
		})();
		return this.loaded;
	}
	loadedScope = null;
	key(rest) {
		return `${this.scope()}|${rest}`;
	}
	readKey(method, params) {
		return this.key(`read:${method}:${stableJson(params ?? {})}`);
	}
};
/** JSON with keys sorted, so the same parameters in another order are the same key. */
function stableJson(value) {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	if (value && typeof value === "object") return `{${Object.keys(value).sort().filter((key) => value[key] !== void 0).map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
	return JSON.stringify(value);
}
export { RpcOffline };
