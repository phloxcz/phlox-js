// src/net/store.ts
/**
* Where data for working offline are kept: a store of keys and JSON values.
* IndexedDB in the browser (it survives closing the application), memory in tests.
*/
var OfflineStore = class {};
/** Keeps the data in memory: for tests, or when IndexedDB is not available. */
var MemoryStore = class extends OfflineStore {
	data = /* @__PURE__ */ new Map();
	async get(key) {
		return structuredClone(this.data.get(key));
	}
	async set(key, value) {
		this.data.set(key, structuredClone(value));
	}
	async delete(key) {
		this.data.delete(key);
	}
	async entries(prefix) {
		return [...this.data.entries()].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, structuredClone(value)]);
	}
};
/** Keeps the data in IndexedDB, in a database of the given name with one store. */
var IndexedDbStore = class extends OfflineStore {
	name;
	db = null;
	constructor(name) {
		super();
		this.name = name;
	}
	async get(key) {
		return this.request("readonly", (store) => store.get(key));
	}
	async set(key, value) {
		await this.request("readwrite", (store) => store.put(value, key));
	}
	async delete(key) {
		await this.request("readwrite", (store) => store.delete(key));
	}
	async entries(prefix) {
		const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
		const [keys, values] = await Promise.all([this.request("readonly", (store) => store.getAllKeys(range)), this.request("readonly", (store) => store.getAll(range))]);
		return keys.map((key, index) => [String(key), values[index]]);
	}
	open() {
		this.db ??= new Promise((resolve, reject) => {
			const request = indexedDB.open(this.name, 1);
			request.onupgradeneeded = () => request.result.createObjectStore("data");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		return this.db;
	}
	async request(mode, make) {
		const db = await this.open();
		return new Promise((resolve, reject) => {
			const request = make(db.transaction("data", mode).objectStore("data"));
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}
};
export { IndexedDbStore, MemoryStore, OfflineStore };
