import { Scope, batch, effect, state, untrack } from "../reactive/reactive.js";
import { resource } from "../ui/resource.js";
import { ERRORS, h, insert } from "../ui/dom.js";
import { Container } from "../di/container.js";
import { APP, createComponent, hasUnsaved, renderComponent } from "../ui/component.js";
import { Toasts, messageTexts, showLoading, showMessage } from "../ui/messages.js";
import { Dialogs, NativeDialogs } from "../ui/dialog.js";
import { THEME, Theme } from "../ui/theme.js";
import { Router } from "./router.js";
import { Authenticator, User, UserStorage, userDefaults } from "../security/user.js";
import { BrowserPreferences, Preferences } from "../ui/preferences.js";
import { Authorizator } from "../security/permission.js";
// src/application/application.ts
/** Application: starts the root presenter and the router. Together with the container it is the bootstrap. */
/**
* Flash messages. The application shows them as toasts. A layout that shows them itself
* (`<For each={this.app.flashes.messages}>`) sets `toasts = false`; an adapter can show them by a library.
*/
var FlashMessages = class {
	messages = state([]);
	/** How long a message stays, in ms. 0 = until removed. */
	duration = 5e3;
	/** Errors stay until the user closes them, the user should not miss them. */
	errorDuration = 0;
	/** The application shows the messages as toasts. */
	toasts = true;
	/** The corner of the toasts. */
	position = "top-right";
	timers = /* @__PURE__ */ new Map();
	add(text, type = "info", options = {}) {
		const duration = options.duration ?? (type === "error" ? this.errorDuration : this.duration);
		const flash = {
			text,
			type,
			duration,
			...options.title ? { title: options.title } : {}
		};
		this.messages.update((list) => [...list, flash]);
		if (duration > 0) {
			this.timers.set(flash, {
				timer: null,
				ends: 0,
				left: duration
			});
			this.resume(flash);
		}
		return flash;
	}
	remove(flash) {
		const running = this.timers.get(flash);
		if (running?.timer) clearTimeout(running.timer);
		this.timers.delete(flash);
		this.messages.update((list) => list.filter((other) => other !== flash));
	}
	clear() {
		for (const flash of [...this.timers.keys()]) this.remove(flash);
		this.messages.set([]);
	}
	/** Stops the time of a message, while the user reads it (the pointer or the focus is on it). */
	pause(flash) {
		const running = this.timers.get(flash);
		if (!running?.timer) return;
		clearTimeout(running.timer);
		running.timer = null;
		running.left = Math.max(0, running.ends - Date.now());
	}
	resume(flash) {
		const running = this.timers.get(flash);
		if (!running || running.timer) return;
		running.ends = Date.now() + running.left;
		running.timer = setTimeout(() => this.remove(flash), running.left);
	}
};
var Application = class {
	container;
	router;
	flashes;
	user;
	/** Classes of rendered forms and dialogs, see ui/theme.ts. */
	theme;
	/** The root presenter while the application is running. */
	presenter = null;
	/**
	* The path the application lives under when it is not at the root of the site, like '/admin'.
	* Routes and links are relative to it, links outside it load another page. Set it before run().
	*/
	basePath = "";
	/**
	* Composes document.title from the title of the page (Presenter.pageTitle()). By default
	* "Page – <the title in index.html>", without a page only the title in index.html.
	*/
	formatTitle = (page) => page ? `${page} – ${this.baseTitle}` : this.baseTitle;
	/** Receives errors from navigation and from life cycle methods that nobody awaits. */
	onError = (error) => console.error(error);
	scope = null;
	/** Versions of the tags of data, see invalidate(). */
	versions = /* @__PURE__ */ new Map();
	started = null;
	toastHost = null;
	/** The title of the page before the application changed it. */
	baseTitle = "";
	/** Tells screen readers that another page is shown, see navigated(). */
	announcer = null;
	/** The container holds services of the application. Services of the framework are added unless it has its own. */
	constructor(container = new Container()) {
		this.container = container;
		container.add(this);
		if (!container.has(Dialogs)) container.add(NativeDialogs);
		if (!container.has(FlashMessages)) container.add(FlashMessages);
		if (!container.has(Theme)) container.add(new Theme());
		if (!container.has(UserStorage)) container.add(userDefaults.BrowserUserStorage);
		if (!container.has(Preferences)) container.add(new BrowserPreferences());
		if (!container.has(Authenticator)) container.add(userDefaults.MissingAuthenticator);
		if (!container.has(Authorizator)) container.add(userDefaults.MissingAuthorizator);
		if (!container.has(User)) container.add(User);
		this.flashes = container.get(FlashMessages);
		this.user = container.get(User);
		this.theme = container.get(Theme);
		this.router = new Router(this);
		container.add(this.router);
	}
	/** Creates the root presenter, routes the current URL and shows the result in the element. */
	async run(root, element) {
		if (this.scope) throw new Error("The application is already running.");
		this.started = {
			root,
			element
		};
		this.scope = new Scope(null);
		this.scope.provide(APP, this);
		this.scope.provide(THEME, this.theme);
		this.scope.provide(ERRORS, (error) => this.onError(error));
		const presenter = this.presenter = createComponent(root, {}, null, this, this.scope);
		document.addEventListener("click", this.onClick);
		window.addEventListener("beforeunload", this.onBeforeUnload);
		await this.router.start(presenter);
		element.replaceChildren(renderComponent(presenter));
		this.baseTitle = document.title;
		this.scope.run(() => effect(() => {
			document.title = this.formatTitle(this.pageTitle());
		}));
		const announcer = this.announcer = document.createElement("div");
		announcer.className = "phlox-announcer";
		announcer.setAttribute("aria-live", "polite");
		announcer.setAttribute("aria-atomic", "true");
		document.body.append(announcer);
		if (this.flashes.toasts) {
			const host = this.toastHost = document.createElement("div");
			document.body.append(host);
			this.scope.run(() => insert(host, h(Toasts, { flashes: this.flashes }), null));
		}
	}
	/** A message with OK, as a dialog or, with `anchor`, as a popover at an element. */
	alert(message, options = {}, opener) {
		return showMessage(this.opener(opener), "alert", message, options).then(() => void 0);
	}
	/** A question with OK and Cancel. True for OK; Escape, a click outside or Cancel is false. */
	confirm(message, options = {}, opener) {
		return showMessage(this.opener(opener), "confirm", message, options);
	}
	/** A question for a text. The text for OK, null for Cancel. */
	prompt(message, options = {}, opener) {
		return showMessage(this.opener(opener), "prompt", message, options);
	}
	/** A dialog without buttons while something runs; close it by the returned handle. */
	showLoading(message = void 0, opener) {
		return showLoading(this.opener(opener).scope, message);
	}
	/**
	* The data with these tags have changed on the server: every resource with one of them loads again,
	* on whatever screen it is. Calls made at once go to the server as one batch.
	*   await this.api.call('task.update', …); this.app.invalidate('tasks');
	*/
	invalidate(...tags) {
		batch(() => {
			for (const tag of tags) this.version(tag).update((version) => version + 1);
		});
	}
	/**
	* A resource of the whole application, for services that hold data many screens show (users, projects).
	* It lives while the application runs. Components use Component.resource().
	*/
	resource(load, options = {}) {
		if (!this.scope) throw new Error("app.resource() needs a running application.");
		return this.createResource(this.scope, load, options);
	}
	/** A resource owned by the scope, reading the versions of its tags. Used by resource() and Component.resource(). */
	createResource(scope, load, options = {}) {
		const tags = options.tags ?? [];
		return scope.run(() => resource(() => {
			for (const tag of tags) this.version(tag)();
			return load();
		}, (error) => this.onError(error)));
	}
	version(tag) {
		let version = this.versions.get(tag);
		if (!version) this.versions.set(tag, version = state(0));
		return version;
	}
	/**
	* Whether the components may leave: true without unsaved changes in them, otherwise the user decides.
	* Null means the whole application. The router and Component.cancel() ask through it.
	*/
	async mayLeave(leaving, opener) {
		if (!hasUnsaved(this, leaving)) return true;
		return this.confirm(messageTexts.unsaved, {
			danger: true,
			okText: messageTexts.leave
		}, opener);
	}
	opener(component) {
		const opener = component ?? this.presenter;
		if (!opener) throw new Error("Messages need a running application.");
		return opener;
	}
	/** The title of the deepest presenter that has one. Reactive. */
	pageTitle() {
		let title = null;
		for (let presenter = this.presenter; presenter; presenter = presenter.child()) title = presenter.pageTitle() ?? title;
		return title;
	}
	/**
	* After a navigation has changed the page. Screen readers hear the title of the new page. When the focus
	* was on something the old page took away, it goes to the main heading of the new one; otherwise it stays
	* (a list with its detail would lose its place).
	*/
	navigated() {
		const announcer = this.announcer;
		if (!announcer) return;
		announcer.textContent = "";
		setTimeout(() => {
			announcer.textContent = document.title;
		}, 50);
		const active = document.activeElement;
		if (active && active !== document.body && active.isConnected) return;
		const heading = untrack(() => this.started?.element.querySelector("h1"));
		if (!heading) return;
		if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
		heading.focus({ preventScroll: true });
	}
	/** Removes everything and stops routing. */
	stop() {
		document.removeEventListener("click", this.onClick);
		window.removeEventListener("beforeunload", this.onBeforeUnload);
		this.router.stop();
		this.toastHost?.remove();
		this.toastHost = null;
		this.announcer?.remove();
		this.announcer = null;
		if (this.baseTitle) document.title = this.baseTitle;
		this.scope?.dispose();
		this.scope = null;
		this.presenter = null;
		this.started?.element.replaceChildren();
	}
	/** Builds the whole tree of presenters again at the same URL, for example after a change of language. */
	async restart() {
		if (!this.started) throw new Error("The application has not been started.");
		const { root, element } = this.started;
		this.stop();
		await this.run(root, element);
	}
	/** Closing or reloading the page, a link to another site: the browser asks with its own question. */
	onBeforeUnload = (event) => {
		if (hasUnsaved(this, null)) event.preventDefault();
	};
	/** A click on an ordinary link to this site becomes a navigation without a page reload. */
	onClick = (event) => {
		if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
		if (!link || link.target || link.hasAttribute("download") || link.origin !== location.origin) return;
		if (!this.router.owns(link.pathname)) return;
		event.preventDefault();
		this.router.navigate(link.pathname + link.search + link.hash);
	};
};
export { Application, FlashMessages };
