import { Scope, getScope, state, untrack } from "../reactive/reactive.js";
import { VIEW, insert } from "./dom.js";
import { Dialogs } from "./dialog.js";
import { Preferences } from "./preferences.js";
// src/ui/component.ts
/** Component: a class with its own state, life cycle and view. The base of presenters and dialogs. */
/** Keys under which a scope provides the application and the component that owns it. */
var APP = Symbol("application");
var COMPONENT = Symbol("component");
/** Marks presenters, so that a component finds its presenter without importing the class. */
var IS_PRESENTER = Symbol("presenter");
/** What the component being constructed right now receives from the framework. */
var creation = null;
/** Components that exist now, for the question about unsaved changes. */
var living = /* @__PURE__ */ new Set();
/** Dialogs closed by their code: they are leaving on purpose, so nobody asks about them. */
var closing = /* @__PURE__ */ new WeakSet();
/**
* Whether a component of the application has unsaved changes and would be lost with the given ones:
* they or a component inside them (a child, a dialog opened from them). Null means the whole application.
*/
function hasUnsaved(app, leaving) {
	for (const component of living) {
		if (component.app !== app || !untrack(() => component.hasUnsavedChanges())) continue;
		let lost = leaving === null;
		for (let owner = component; owner; owner = owner.parent) {
			if (closing.has(owner)) {
				lost = false;
				break;
			}
			if (leaving?.includes(owner)) lost = true;
		}
		if (lost) return true;
	}
	return false;
}
/**
* P are the props, R is the result the component returns when it is closed as a dialog.
* The constructor is for services, they are autowired. Props are ready in `this.props` from the start.
*/
var Component = class {
	props;
	parent;
	app;
	/** Owns everything the component creates. Disposing it removes the component. */
	scope;
	/** Set by whoever shows the component in a dialog. */
	onClose = null;
	constructor() {
		if (!creation) throw new Error(`${new.target.name} must be created by the framework: use it in TSX, in a route or in openDialog().`);
		this.props = creation.props;
		this.parent = creation.parent;
		this.app = creation.app;
		this.scope = creation.scope;
		creation = null;
	}
	/** The nearest presenter above the component (or the component itself), like getPresenter() in Nette. */
	get presenter() {
		for (let owner = this; owner; owner = owner.parent) if (IS_PRESENTER in owner) return owner;
		throw new Error(`${this.constructor.name} is not inside a presenter.`);
	}
	link(destination, params) {
		return this.app.router.link(this.presenter, destination, params);
	}
	/** The logged-in user, like $this->user in Nette. */
	get user() {
		return this.app.user;
	}
	/** Runs once after the component is created, before it is rendered. Load data here. */
	startup() {}
	/** Runs once the view is in the page. The place for widgets that need real elements. */
	afterRender() {}
	/** Runs when the component is removed. State, effects and listeners are cleaned up without it. */
	shutdown() {}
	/** Title of the window when the component is shown in a dialog. */
	title() {
		return "";
	}
	/** Buttons of the window when the component is shown in a dialog. */
	actions() {
		return null;
	}
	/**
	* True while the component holds changes the user would lose, typically `this.form.isChanged()`.
	* Before the component leaves (another URL, Escape in its dialog, closing the page) the user is asked.
	*/
	hasUnsavedChanges() {
		return false;
	}
	/**
	* Data loaded by the function, again whenever state it read before its first await changes:
	* `tasks = this.resource(() => this.api.call('task.list', { status: this.status() }))`, in the template `tasks()`.
	* With `{ tags: ['tasks'] }` also after app.invalidate('tasks').
	* Create it in the constructor or in startup(), it ends with the component. Errors go to app.onError.
	*/
	resource(load, options = {}) {
		return this.app.createResource(this.scope, load, options);
	}
	/**
	* A setting of the user that the application remembers, e.g. the width of a column:
	* `width = this.preference('tasks.width', 416)`. It is a state, every change is saved by the Preferences
	* service (localStorage unless the application registers another).
	*/
	preference(key, initial) {
		return this.app.container.get(Preferences).state(key, initial);
	}
	/** A message with OK, see Application.alert(). With `anchor` a popover at an element. */
	/** Like flashMessage() in Nette, in a component as in a presenter. It disappears by itself, see FlashMessages.duration. */
	flashMessage(text, type = "info", options = {}) {
		this.app.flashes.add(text, type, options);
	}
	alert(message, options = {}) {
		return this.app.alert(message, options, this);
	}
	/** A question with OK and Cancel, true for OK. With `anchor` a popover at an element. */
	confirm(message, options = {}) {
		return this.app.confirm(message, options, this);
	}
	/** A question for a text, null for Cancel. With `anchor` a popover at an element. */
	prompt(message, options = {}) {
		return this.app.prompt(message, options, this);
	}
	/**
	* A dialog while something runs: const loading = this.showLoading('Saving…'); … loading.close().
	* Not loading(): that is a usual name of an own field, like loading = state(false).
	*/
	showLoading(message) {
		return this.app.showLoading(message, this);
	}
	/** Closes the dialog the component is shown in and hands the result to whoever opened it. It does not ask. */
	close(result) {
		closing.add(this);
		this.onClose?.(result);
	}
	/** The user closes the dialog (Escape, ×): with unsaved changes it asks first, then close(). */
	async cancel() {
		if (await this.app.mayLeave([this], this)) this.close();
	}
	/**
	* Opens a component in a dialog and waits until it is closed. `{ placement: 'end' }` slides it in from the right.
	* Returns what the dialog passed to close(), or undefined when it was closed another way.
	*/
	async openDialog(cls, props, options) {
		const dialog = createComponent(cls, props, this, this.app, this.scope);
		try {
			await startComponent(dialog);
		} catch (error) {
			dialog.scope.dispose();
			throw error;
		}
		if (dialog.scope.disposed) return void 0;
		return new Promise((resolve) => {
			let result;
			dialog.scope.onCleanup(() => resolve(result));
			dialog.onClose = (value) => {
				result = value;
				dialog.scope.dispose();
			};
			showDialog(dialog, options);
		});
	}
	/** Called by the renderer for <MyComponent /> in TSX. */
	static [VIEW](props) {
		const scope = getScope();
		const app = scope?.find(APP);
		if (!app) throw new Error(`<${this.name} /> can be used only inside a running Application.`);
		const component = createComponent(this, props, scope.find(COMPONENT) ?? null, app, scope);
		props.ref?.(component);
		const started = startComponent(component);
		if (!(started instanceof Promise)) return renderComponent(component);
		const ready = state(false);
		started.then(() => component.scope.disposed || ready.set(true), (error) => app.onError(error, "lifecycle"));
		return () => ready() ? renderComponent(component) : null;
	}
};
/** Creates a component with its own scope. Services in its constructor are autowired. */
function createComponent(cls, props, parent, app, owner) {
	const scope = new Scope(owner);
	creation = {
		props,
		parent,
		app,
		scope
	};
	try {
		const component = scope.run(() => app.container.create(cls));
		scope.provide(COMPONENT, component);
		living.add(component);
		scope.onCleanup(() => living.delete(component));
		scope.onCleanup(() => component.shutdown());
		return component;
	} catch (error) {
		scope.dispose();
		throw error;
	} finally {
		creation = null;
	}
}
/** Runs startup() of a component. Effects it creates before its first await belong to the component. */
function startComponent(component) {
	return component.scope.run(() => component.startup());
}
/** Builds the view of a component. Call it once for every component. */
function renderComponent(component) {
	const fragment = document.createDocumentFragment();
	component.scope.run(() => untrack(() => insert(fragment, component.render(), null)));
	queueMicrotask(async () => {
		if (component.scope.disposed) return;
		try {
			await component.afterRender();
		} catch (error) {
			component.app.onError(error, "lifecycle");
		}
	});
	return fragment;
}
/** Shows a started component in a window, the window disappears with the component. */
function showDialog(dialog, options) {
	const hide = dialog.app.container.get(Dialogs).show(dialog, options);
	dialog.scope.onCleanup(hide);
}
export { APP, COMPONENT, Component, IS_PRESENTER, createComponent, hasUnsaved, renderComponent, showDialog, startComponent };
