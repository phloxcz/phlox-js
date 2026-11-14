// src/reactive/reactive.ts
var CLEAN = 0;
var CHECK = 1;
var DIRTY = 2;
var MAX_FLUSH_PASSES = 1e3;
var currentScope = null;
var tracking = null;
var queue = [];
var flushing = false;
var batchDepth = 0;
/** Owns effects, computed values and cleanups. Disposing it disposes everything inside. */
var Scope = class {
	parent;
	depth;
	disposed = false;
	children = /* @__PURE__ */ new Set();
	cleanups = [];
	values = null;
	constructor(parent = currentScope) {
		this.parent = parent;
		this.depth = parent ? parent.depth + 1 : 0;
		parent?.children.add(this);
	}
	/** Makes a value available to everything created inside this scope. */
	provide(key, value) {
		(this.values ??= /* @__PURE__ */ new Map()).set(key, value);
	}
	/** Finds a value provided by this scope or by the nearest scope above it. */
	find(key) {
		return this.values?.has(key) ? this.values.get(key) : this.parent?.find(key);
	}
	run(fn) {
		if (this.disposed) throw new Error("Cannot run in a disposed scope.");
		const previous = currentScope;
		currentScope = this;
		try {
			return fn();
		} finally {
			currentScope = previous;
		}
	}
	onCleanup(fn) {
		this.cleanups.push(fn);
	}
	/** A failing cleanup is only logged, it must not stop the others. */
	clear() {
		for (const child of [...this.children]) child.dispose();
		for (const cleanup of this.cleanups.splice(0).reverse()) try {
			cleanup();
		} catch (error) {
			console.error(error);
		}
	}
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.clear();
		this.parent?.children.delete(this);
	}
};
var Observer = class extends Scope {
	status = DIRTY;
	sources = /* @__PURE__ */ new Set();
	mark(status) {
		if (this.status >= status) return;
		const wasClean = this.status === CLEAN;
		this.status = status;
		if (wasClean) this.notify();
	}
	/** Brings this observer up to date, sources are read in the order they were tracked. */
	refresh() {
		if (this.status === CHECK) {
			for (const source of this.sources) {
				source.refresh?.();
				if (this.status === DIRTY) break;
			}
			if (this.status === CHECK) this.status = CLEAN;
		}
		if (this.status === DIRTY) this.recompute();
	}
	execute(fn) {
		this.clear();
		this.unlink();
		this.status = CLEAN;
		const previous = tracking;
		tracking = this;
		try {
			return this.run(fn);
		} finally {
			tracking = previous;
		}
	}
	unlink() {
		for (const source of this.sources) source.observers.delete(this);
		this.sources.clear();
	}
	dispose() {
		super.dispose();
		this.unlink();
	}
};
var Computed = class extends Observer {
	fn;
	observers = /* @__PURE__ */ new Set();
	value;
	error;
	failed = false;
	computed = false;
	running = false;
	constructor(fn) {
		super();
		this.fn = fn;
	}
	read() {
		if (this.disposed) return untrack(this.fn);
		if (this.running) throw new Error("Circular dependency in computed.");
		this.refresh();
		track(this);
		if (this.failed) throw this.error;
		return this.value;
	}
	recompute() {
		this.running = true;
		let changed;
		try {
			const value = this.execute(this.fn);
			changed = this.failed || !this.computed || !Object.is(this.value, value);
			this.value = value;
			this.failed = false;
		} catch (error) {
			changed = true;
			this.error = error;
			this.failed = true;
		} finally {
			this.running = false;
		}
		this.computed = true;
		if (changed) markObservers(this, DIRTY);
	}
	notify() {
		markObservers(this, CHECK);
	}
};
var Effect = class extends Observer {
	fn;
	constructor(fn) {
		super();
		this.fn = fn;
	}
	recompute() {
		const cleanup = this.execute(this.fn);
		if (cleanup) this.onCleanup(cleanup);
	}
	notify() {
		queue.push(this);
	}
};
function track(source) {
	if (!tracking || tracking.disposed) return;
	tracking.sources.add(source);
	source.observers.add(tracking);
}
function markObservers(source, status) {
	for (const observer of source.observers) observer.mark(status);
}
/** Runs queued effects, parents first, so a child never runs on data its parent is about to remove. */
function flush() {
	if (flushing || batchDepth > 0) return;
	flushing = true;
	const errors = [];
	try {
		for (let pass = 0; queue.length > 0; pass++) {
			if (pass >= MAX_FLUSH_PASSES) {
				queue = [];
				throw new Error("Effects keep changing state they depend on.");
			}
			const effects = queue.sort((a, b) => a.depth - b.depth);
			queue = [];
			for (const effect of effects) {
				if (effect.disposed) continue;
				try {
					effect.refresh();
				} catch (error) {
					errors.push(error);
				}
			}
		}
	} finally {
		flushing = false;
	}
	if (errors.length > 0) throw errors[0];
}
function state(initial) {
	let value = initial;
	const source = { observers: /* @__PURE__ */ new Set() };
	const read = (() => {
		track(source);
		return value;
	});
	read.set = (next) => {
		if (tracking instanceof Computed) throw new Error("A computed must not change state.");
		if (Object.is(value, next)) return;
		value = next;
		markObservers(source, DIRTY);
		flush();
	};
	read.update = (change) => read.set(change(untrack(() => value)));
	return read;
}
/** A derived value. It is computed lazily and recomputed only when its sources really changed. */
function computed(fn) {
	const node = new Computed(fn);
	return () => node.read();
}
/** Runs now and again after every change of what it read. It may return a cleanup. Returns a dispose function. */
function effect(fn) {
	const node = new Effect(fn);
	batch(() => node.refresh());
	return () => node.dispose();
}
/** Applies several changes at once, effects run after the last one. */
function batch(fn) {
	batchDepth++;
	try {
		return fn();
	} finally {
		batchDepth--;
		flush();
	}
}
/** Reads without subscribing. */
function untrack(fn) {
	const previous = tracking;
	tracking = null;
	try {
		return fn();
	} finally {
		tracking = previous;
	}
}
/** The scope that owns whatever is being created right now. */
function getScope() {
	return currentScope;
}
/** Registers a cleanup in the current scope. Outside of a scope there is nothing that could call it. */
function onCleanup(fn) {
	currentScope?.onCleanup(fn);
}
export { Scope, batch, computed, effect, getScope, onCleanup, state, untrack };
