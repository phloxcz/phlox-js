import { getScope, state } from "../reactive/reactive.js";
import { COMPONENT, Component, IS_PRESENTER, renderComponent } from "./component.js";
// src/ui/presenter.ts
/** Presenter: a component that URL leads to. Presenters form a tree and split the URL among themselves. */
/**
* A route with typed parameters: `route('detail', '/<task:int>', { presenter: TaskDetail, props: ({ task }) => ({ taskId: task }) })`.
* `task` is a number in props and dialog, and link(this.detail, { task: 5 }) is checked by the compiler.
*/
function route(name, pattern, options = {}) {
	return {
		name,
		pattern,
		...options
	};
}
var BadRequestError = class extends Error {
	code;
	constructor(code = 404, message = `Bad request (${code}).`) {
		super(message);
		this.code = code;
		this.name = "BadRequestError";
	}
};
var Presenter = class extends Component {
	[IS_PRESENTER] = true;
	/** Routes of the presenter, tried in this order. */
	routes = [];
	/**
	* Query parameters the links of this presenter and of those below it keep, like #[Persistent] in Nette:
	* with ['page'], link('detail', { id: 5 }) on ?page=2 leads to /5?page=2. A name ending with * stands
	* for all that start with it, e.g. 'filter.*'. A parameter given to link() wins, null leaves it out.
	*/
	persistent = [];
	/** Name of the current route, null when no route matches. */
	route = state(null);
	/** Parameters of the current route. A presenter whose route has no child presenter gets query parameters too. */
	params = state({});
	/** Presenter shown in <RouteFrame />. */
	child = state(null);
	/** The part of the URL handled by the presenters above. */
	basePath = state("");
	/** Used by the router to tell what has changed since the last navigation. */
	routing = {
		matchKey: "",
		actionKey: "",
		dialog: null
	};
	redirect(destination, params) {
		this.app.router.navigate(this.app.router.link(this, destination, params), {
			replace: true,
			refresh: this
		});
	}
	/** Ends the action with an error, like $this->error() in Nette. */
	error(code = 404, message) {
		throw new BadRequestError(code, message);
	}
	/**
	* The title of the page, like {block title} in Nette. The deepest presenter with a title gives
	* document.title, composed by app.formatTitle(). It may read state: `() => this.task()?.name`.
	*/
	pageTitle() {
		return null;
	}
	/** Called when the rest of the URL matches no route of this presenter. Override it to show something else. */
	notFound(path) {
		this.error(404, `No route of ${this.constructor.name} matches '${path}'.`);
	}
};
/** The place in render() of a presenter where the presenter of its current route is shown. */
function RouteFrame() {
	const presenter = getScope()?.find(COMPONENT);
	if (!(presenter instanceof Presenter)) throw new Error("<RouteFrame /> can be used only in render() of a presenter.");
	return () => {
		const child = presenter.child();
		return child ? renderComponent(child) : null;
	};
}
export { BadRequestError, Presenter, RouteFrame, route };
