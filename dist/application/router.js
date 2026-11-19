import { batch, state, untrack } from "../reactive/reactive.js";
import { createComponent, showDialog, startComponent } from "../ui/component.js";
import { Presenter } from "../ui/presenter.js";
// src/application/router.ts
/**
* Router: walks the tree of presenters from the root and gives each of them its part of the URL.
* Only one navigation runs at a time. A newer one waits for it and the running one gives up at its next step.
*/
/** Thrown inside a navigation that has been replaced by a newer one. */
var SUPERSEDED = Symbol("superseded");
/** Thrown when the user stays because of unsaved changes. */
var CANCELLED = Symbol("cancelled");
/** A presenter without routes is a single page, its action is actionDefault(). */
var DEFAULT_ROUTES = [{
	name: "default",
	pattern: "/"
}];
var patterns = /* @__PURE__ */ new Map();
var loaded = /* @__PURE__ */ new WeakMap();
/** Types of parameters, `<id:int>`: the regular expression and how the text becomes the value. */
var TYPES = { int: {
	expression: "\\d+",
	convert: Number
} };
/** A pattern part `<name>`, `<name:type>` or `<name expression>`. */
var PARAM = /<(\w+)(?::(\w+))?(?:\s+([^>]+))?>/g;
/**
* `/users/<id:int>` or `/users/<id \d+>` becomes a regular expression with named groups.
* It must end at a slash or at the end.
*/
function toRegExp(pattern) {
	let regExp = patterns.get(pattern);
	if (!regExp) {
		const source = pattern.replace(new RegExp(`${PARAM.source}|[.*+?^\${}()|[\\]\\\\]`, "g"), (text, name, type, expression) => {
			if (!name) return `\\${text}`;
			if (type && !TYPES[type]) throw new Error(`Unknown type '${type}' of parameter '${name}' in the route '${pattern}', known: ${Object.keys(TYPES).join(", ")}.`);
			if (expression && /^[dws][+*]$/.test(expression)) throw new Error(`The route '${pattern}' has '${expression}' in parameter '${name}': write '\\\\${expression}' in the string, or <${name}:int>.`);
			return `(?<${name}>${type ? TYPES[type].expression : expression ?? "[^/]+"})`;
		});
		regExp = new RegExp(pattern === "/" ? "^/?$" : `^${source}(?=/|$)`);
		patterns.set(pattern, regExp);
	}
	return regExp;
}
function decode(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
/** The parameters converted by their types, for props and dialog of a route. */
function typed(pattern, params) {
	const values = { ...params };
	for (const [, name, type] of pattern.matchAll(PARAM)) if (type && name in params) values[name] = TYPES[type].convert(params[name]);
	return values;
}
/** Finds the first route that matches the beginning of the path, or all of it when nothing handles the rest. */
function match(routes, path) {
	for (const route of routes) {
		const found = toRegExp(route.pattern).exec(path);
		if (!found) continue;
		const remaining = path.slice(found[0].length);
		const exact = remaining === "" || remaining === "/";
		if (!exact && !route.presenter && !route.dialog) continue;
		const params = {};
		for (const [name, value] of Object.entries(found.groups ?? {})) if (value !== void 0) params[name] = decode(value);
		return {
			route,
			params,
			matched: found[0] === "/" ? "" : found[0],
			remaining,
			exact
		};
	}
	return null;
}
async function loadPresenter(route) {
	let cls = loaded.get(route);
	if (!cls) {
		const source = route.presenter;
		if (source.prototype instanceof Presenter) cls = source;
		else {
			const module = await source();
			cls = "default" in module ? module.default : module;
		}
		loaded.set(route, cls);
	}
	return cls;
}
function splitUrl(url) {
	const parsed = new URL(url, location.origin);
	const path = parsed.pathname.length > 1 && parsed.pathname.endsWith("/") ? parsed.pathname.slice(0, -1) : parsed.pathname;
	return {
		path,
		query: Object.fromEntries(parsed.searchParams),
		full: path + parsed.search + parsed.hash
	};
}
function joinUrl(path, query) {
	const search = new URLSearchParams();
	for (const [name, value] of Object.entries(query)) if (value !== null && value !== void 0) search.set(name, String(value));
	return ((path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path) || "/") + (search.size > 0 ? `?${search}` : "");
}
var Router = class {
	app;
	/** Path and query of the page that is shown. */
	url = state("");
	root = null;
	/** The position in history of the page that is shown, to return Back when the user stays. */
	index = 0;
	returning = false;
	running = null;
	/** Presenters created but not started: startup() runs once the router knows their route and parameters. */
	pending = /* @__PURE__ */ new WeakSet();
	queued = null;
	constructor(app) {
		this.app = app;
	}
	/** Starts routing from the current URL of the browser. */
	start(root) {
		this.root = root;
		this.pending.add(root);
		this.index = history.state?.phlox ?? 0;
		window.addEventListener("popstate", this.onPopState);
		return this.enqueue({
			url: location.href,
			history: "none",
			refresh: null
		});
	}
	stop() {
		window.removeEventListener("popstate", this.onPopState);
		this.root = null;
	}
	/** Goes to the URL. The promise is fulfilled when the navigation ends, even if it fails or a newer one replaces it. */
	navigate(url, options = {}) {
		return this.enqueue({
			url,
			history: options.replace ? "replace" : "push",
			refresh: options.refresh ?? null
		});
	}
	/** Creates a URL, see Presenter.link(). */
	link(presenter, destination, params = {}) {
		if (destination === "this") {
			const current = splitUrl(this.running ? this.running.url : this.url());
			return joinUrl(current.path, {
				...current.query,
				...params
			});
		}
		if (typeof destination === "string" && destination.startsWith("/")) return joinUrl(this.base + destination, params);
		const route = typeof destination === "string" ? presenter.routes.find((candidate) => candidate.name === destination) : destination;
		if (!route) throw new Error(`${presenter.constructor.name} has no route '${destination}'.`);
		const query = {
			...this.persistentOf(presenter),
			...params
		};
		const path = route.pattern.replace(PARAM, (_text, name, type) => {
			const value = params[name];
			if (value === void 0 || value === null || value === "") throw new Error(`Missing parameter '${name}' for route '${route.name}' of ${presenter.constructor.name}.`);
			if (type && !new RegExp(`^${TYPES[type].expression}$`).test(String(value))) throw new Error(`Parameter '${name}' of route '${route.name}' must be ${type}, got '${String(value)}'.`);
			delete query[name];
			return encodeURIComponent(String(value));
		});
		return joinUrl(presenter.basePath() + path, query);
	}
	/** Current values of the persistent parameters of the presenter and of the presenters above it. */
	persistentOf(presenter) {
		return this.persistentQuery(presenter, splitUrl(this.running ? this.running.url : this.url()).query);
	}
	/** The parameters of the query that are persistent for the presenter or for a presenter above it. */
	persistentQuery(presenter, query) {
		const names = [];
		for (let owner = presenter; owner; owner = owner.parent) if (owner instanceof Presenter) names.push(...owner.persistent);
		if (!names.length) return {};
		const kept = (name) => names.some((pattern) => pattern.endsWith("*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern);
		return Object.fromEntries(Object.entries(query).filter(([name]) => kept(name)));
	}
	/** The base path of the application without the slash at the end, see Application.basePath. */
	get base() {
		return this.app.basePath.replace(/\/+$/, "");
	}
	/** Whether the path belongs to the application, that is it lies under its base path. */
	owns(path) {
		return !this.base || path === this.base || path.startsWith(`${this.base}/`);
	}
	onPopState = () => {
		if (this.returning) {
			this.returning = false;
			return;
		}
		this.enqueue({
			url: location.href,
			history: "none",
			refresh: null,
			pop: true
		});
	};
	/** The user stays after Back or Forward: the browser goes back to the page that is shown. */
	returnBack() {
		const steps = (history.state?.phlox ?? 0) - this.index;
		if (steps) {
			this.returning = true;
			history.go(-steps);
		} else history.pushState({ phlox: this.index }, "", this.url());
	}
	enqueue(navigation) {
		if (!this.running) return this.process(navigation);
		if (navigation.history === "replace" && this.running.history === "push") navigation.history = "push";
		this.queued?.done();
		return new Promise((done) => {
			this.queued = {
				navigation,
				done
			};
		});
	}
	async process(navigation) {
		this.running = navigation;
		try {
			await this.run(navigation);
		} catch (error) {
			if (error !== SUPERSEDED && error !== CANCELLED) this.app.onError(error);
		} finally {
			this.running = null;
			const next = this.queued;
			this.queued = null;
			if (next) this.process(next.navigation).then(next.done);
		}
	}
	/**
	* Prepares the whole new state aside: runs actions and creates and starts new presenters and dialogs.
	* The page changes only at the end, so the old screen stays until the new one is ready.
	*/
	async run(navigation) {
		const { path, query, full } = splitUrl(navigation.url);
		if (!this.owns(path)) return location.assign(full);
		const commits = [];
		const created = [];
		const leaving = [];
		const undo = [];
		const changed = [];
		const check = () => {
			if (this.queued) throw SUPERSEDED;
		};
		const start = async (presenter) => {
			if (!this.pending.delete(presenter)) return;
			await startComponent(presenter);
			check();
		};
		try {
			let presenter = this.root;
			let base = this.base;
			let rest = path.slice(base.length) || "/";
			let refresh = false;
			/** The user was asked about a presenter that stays; what leaves is inside it, so no second question */
			let asked = false;
			while (presenter) {
				const current = presenter;
				const routing = current.routing;
				refresh ||= current === navigation.refresh;
				const found = match(current.routes.length > 0 ? current.routes : DEFAULT_ROUTES, rest);
				if (!found) {
					if (this.pending.has(current)) {
						batch(() => {
							current.basePath.set(base);
							current.route.set(null);
							current.params.set({});
						});
						await start(current);
					}
					current.notFound(rest);
					changed.push({
						presenter: current,
						matchKey: routing.matchKey
					});
					undo.push(this.snapshot(current));
					if (routing.dialog) leaving.push(routing.dialog.component);
					const old = untrack(current.child);
					if (old) leaving.push(old);
					routing.matchKey = routing.actionKey = "";
					batch(() => {
						current.basePath.set(base);
						current.route.set(null);
						current.params.set({});
					});
					commits.push(() => {
						if (routing.dialog) this.closeDialog(current, routing.dialog);
						this.replaceChild(current, null);
					});
					break;
				}
				const { route, params, matched, remaining, exact } = found;
				const all = route.presenter ? {
					...this.persistentQuery(current, query),
					...params
				} : {
					...query,
					...params
				};
				const matchKey = JSON.stringify([route.name, params]);
				const actionKey = JSON.stringify([route.name, all]);
				const routeChanged = matchKey !== routing.matchKey;
				const actionChanged = actionKey !== routing.actionKey;
				if (routeChanged || actionChanged) changed.push({
					presenter: current,
					matchKey: routing.matchKey
				});
				undo.push(this.snapshot(current));
				if (routeChanged && !asked && routing.matchKey && !this.pending.has(current) && !refresh) {
					asked = true;
					if (!await this.app.mayLeave([current])) {
						if (navigation.pop) this.returnBack();
						throw CANCELLED;
					}
					check();
				}
				routing.matchKey = matchKey;
				routing.actionKey = actionKey;
				batch(() => {
					current.basePath.set(base);
					current.route.set(route.name);
					if (actionChanged) current.params.set(all);
				});
				await start(current);
				if (actionChanged || refresh) {
					await current[`action${route.name.charAt(0).toUpperCase()}${route.name.slice(1)}`]?.(all);
					check();
				}
				let next = null;
				const dialog = await this.prepareDialog(current, route, params, commits, created, leaving);
				check();
				if (dialog instanceof Presenter) next = dialog;
				if (route.presenter) {
					const cls = await loadPresenter(route);
					check();
					const old = untrack(current.child);
					if (old && !routeChanged && old.constructor === cls) next = old;
					else {
						if (old) leaving.push(old);
						const child = createComponent(cls, route.props?.(typed(route.pattern, params)) ?? {}, current, this.app, current.scope);
						created.push(child);
						this.pending.add(child);
						commits.push(() => this.replaceChild(current, child));
						next = child;
					}
				} else if (untrack(current.child)) {
					leaving.push(untrack(current.child));
					commits.push(() => this.replaceChild(current, null));
				}
				if (!next && !exact) {
					current.notFound(rest);
					break;
				}
				base += matched;
				rest = remaining || "/";
				presenter = next;
			}
			check();
			if (leaving.length && !asked && !await this.app.mayLeave(leaving)) {
				if (navigation.pop) this.returnBack();
				throw CANCELLED;
			}
			check();
		} catch (error) {
			for (const component of created) component.scope.dispose();
			if (error === CANCELLED) for (const restore of undo) restore();
			for (const { presenter, matchKey } of changed) presenter.routing.matchKey = matchKey, presenter.routing.actionKey = "";
			throw error;
		}
		for (const commit of commits) commit();
		const index = history.state?.phlox ?? 0;
		const shown = location.pathname + location.search + location.hash;
		if (navigation.history === "push" && full !== shown) history.pushState({ phlox: index + 1 }, "", full);
		else if (navigation.history !== "none") history.replaceState({ phlox: index }, "", full);
		this.index = history.state?.phlox ?? 0;
		const first = this.url() === "";
		this.url.set(joinUrl(path, query));
		if (!first && changed.some(({ presenter, matchKey }) => presenter.routing.matchKey !== matchKey)) this.app.navigated();
	}
	/** Remembers where the presenter is, to put it back when the user stays. */
	snapshot(presenter) {
		const route = untrack(presenter.route), params = untrack(presenter.params), base = untrack(presenter.basePath);
		return () => batch(() => {
			presenter.route.set(route);
			presenter.params.set(params);
			presenter.basePath.set(base);
		});
	}
	/** Keeps the dialog of the route when it is already open, otherwise prepares a new one and closes the old one. */
	async prepareDialog(presenter, route, params, commits, created, leaving) {
		const active = presenter.routing.dialog;
		const key = route.dialog ? JSON.stringify([route.name, params]) : null;
		if (active && active.key === key) return active.component;
		if (active) {
			leaving.push(active.component);
			commits.push(() => this.closeDialog(presenter, active));
		}
		if (!route.dialog) return null;
		const [cls, props, options] = route.dialog(typed(route.pattern, params));
		const component = createComponent(cls, props, presenter, this.app, presenter.scope);
		created.push(component);
		if (component instanceof Presenter && !route.presenter) this.pending.add(component);
		else await startComponent(component);
		const dialog = {
			route,
			key,
			component,
			result: void 0
		};
		component.onClose = (result) => {
			dialog.result = result;
			this.leaveDialog(presenter);
		};
		commits.push(() => {
			presenter.routing.dialog = dialog;
			showDialog(component, options);
		});
		return component;
	}
	closeDialog(presenter, dialog) {
		if (dialog.component instanceof Presenter) this.closeDialogsOf(dialog.component);
		if (presenter.routing.dialog === dialog) presenter.routing.dialog = null;
		dialog.component.scope.dispose();
		dialog.route.closed?.call(presenter, dialog.result);
	}
	/**
	* Closes the routed dialogs of a presenter that is leaving, and of the presenters below it,
	* the topmost first, so that every `closed` learns about it.
	*/
	closeDialogsOf(presenter) {
		const child = untrack(presenter.child);
		if (child) this.closeDialogsOf(child);
		if (presenter.routing.dialog) this.closeDialog(presenter, presenter.routing.dialog);
	}
	/**
	* Leaves the URL of a dialog. Inside the application it goes back, so the Back button does not reopen the dialog.
	* After a direct link there is nowhere to go back, so the URL of the presenter replaces the URL of the dialog.
	*/
	leaveDialog(presenter) {
		if ((history.state?.phlox ?? 0) > 0) history.back();
		else this.navigate(joinUrl(untrack(presenter.basePath) || "/", this.persistentOf(presenter)), { replace: true });
	}
	/** The old presenter is shut down while its view is still in the page. */
	replaceChild(presenter, child) {
		const old = untrack(presenter.child);
		if (old === child) return;
		if (old) this.closeDialogsOf(old);
		old?.scope.dispose();
		presenter.child.set(child);
	}
};
export { Router };
