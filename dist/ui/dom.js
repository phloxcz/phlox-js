import { Scope, effect, getScope, onCleanup, untrack } from "../reactive/reactive.js";
// src/ui/dom.ts
/**
* TSX renderer. `h()` returns only a template, real DOM is created once, when the template is inserted.
* Later changes go directly to the nodes that depend on them.
*/
/** A class used as a tag has a static method under this key, it creates the view for the given props. */
var VIEW = Symbol("view");
/** Key under which a scope provides where errors of event handlers go; the application gives app.onError. */
var ERRORS = Symbol("errors");
/** Set as DOM properties, their attributes hold only the initial value. */
var PROPERTIES = /* @__PURE__ */ new Set([
	"value",
	"checked",
	"selected",
	"muted",
	"indeterminate"
]);
/** `false` is a real value here, for other attributes it means the attribute is absent. */
var STRINGIFIED = /^(aria-|data-|draggable$|contenteditable$|spellcheck$)/;
var TEMPLATE = Symbol("template");
var SVG = "http://www.w3.org/2000/svg";
/** SVG while the children of an <svg> are created, so that <path> inside it is an SVG element. */
var inSvg = false;
/**
* Runs the function with the namespace of children of the parent: SVG inside <svg>, except in <foreignObject>.
* A fragment is not in the page yet, what is created into it keeps the namespace of the place that creates it.
*/
function withNamespaceOf(parent, fn) {
	if (parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE) return fn();
	const previous = inSvg;
	inSvg = parent.namespaceURI === SVG && parent.nodeName !== "foreignObject";
	try {
		return fn();
	} finally {
		inSvg = previous;
	}
}
/**
* Creates a template. Nothing is built and no component runs until the template is inserted,
* so a branch that is never shown costs nothing. Every insertion creates a new instance.
*/
function h(tag, props, ...children) {
	const create = () => {
		if (typeof tag === "function") {
			const all = { ...props };
			if (children.length > 0) all.children = children.length === 1 ? children[0] : children;
			const view = tag[VIEW];
			return view ? view.call(tag, all) : tag(all);
		}
		const element = tag === "svg" || inSvg ? document.createElementNS(SVG, tag) : document.createElement(tag);
		withNamespaceOf(element, () => insert(element, children, null));
		for (const [name, value] of Object.entries(props ?? {})) if (name !== "ref") setProp(element, name, value);
		(props?.ref)?.(element);
		return element;
	};
	const info = {
		tag,
		props,
		children: children.length === 0 ? void 0 : children.length === 1 ? children[0] : children
	};
	return Object.assign(create, { [TEMPLATE]: info });
}
/** Tells what a template was made from, or null when the value is not a template. */
function templateOf(value) {
	return typeof value === "function" && TEMPLATE in value ? value[TEMPLATE] : null;
}
function Fragment(props) {
	const fragment = document.createDocumentFragment();
	insert(fragment, props.children, null);
	return fragment;
}
function setProp(element, name, value) {
	if (/^on[A-Z]/.test(name)) {
		const type = name.slice(2).toLowerCase();
		const listener = withErrors(value);
		element.addEventListener(type, listener);
		onCleanup(() => element.removeEventListener(type, listener));
	} else if (typeof value === "function") effect(() => applyProp(element, name, value()));
	else applyProp(element, name, value);
}
/**
* An error of a handler, thrown or of the promise it returns (`onClick={() => this.handleSave()}`),
* goes to the application instead of getting lost. Outside an application the handler stays as it is.
*/
function withErrors(handler) {
	const report = getScope()?.find(ERRORS);
	if (!report) return handler;
	return (event) => {
		try {
			const result = handler(event);
			if (typeof result?.then === "function") result.then(void 0, report);
		} catch (error) {
			report(error);
		}
	};
}
function applyProp(element, name, value) {
	if (PROPERTIES.has(name)) element[name] = value ?? "";
	else if (name === "style" && typeof value === "object" && value !== null) {
		element.removeAttribute("style");
		Object.assign(element.style, value);
	} else if (value === null || value === void 0 || value === false && !STRINGIFIED.test(name)) element.removeAttribute(name);
	else element.setAttribute(name, value === true && !STRINGIFIED.test(name) ? "" : String(value));
}
/**
* Inserts anything a view can contain. A template is created now,
* any other function becomes a region that keeps itself up to date.
*/
function insert(parent, value, before) {
	if (value === null || value === void 0 || typeof value === "boolean") return;
	if (Array.isArray(value)) for (const item of value) insert(parent, item, before);
	else if (templateOf(value)) insert(parent, untrack(value), before);
	else if (typeof value === "function") region(parent, value, before);
	else if (value instanceof Node) parent.insertBefore(value, before);
	else parent.insertBefore(document.createTextNode(String(value)), before);
}
/** Content between two markers. Text is updated in place, anything else is replaced. */
function region(parent, read, before) {
	const start = parent.insertBefore(document.createComment(""), before);
	const end = parent.insertBefore(document.createComment(""), before);
	let text = null;
	effect(() => {
		const value = read();
		if (text && (typeof value === "string" || typeof value === "number")) {
			text.data = String(value);
			return;
		}
		removeBetween(start, end);
		text = null;
		if (typeof value === "string" || typeof value === "number") {
			text = document.createTextNode(String(value));
			end.parentNode.insertBefore(text, end);
		} else withNamespaceOf(end.parentNode, () => insert(end.parentNode, value, end));
	});
}
function removeBetween(start, end) {
	while (start.nextSibling !== end) end.parentNode.removeChild(start.nextSibling);
}
/**
* Renders a view into the container and returns a function that removes it.
* The view is built aside, so a failure leaves nothing in the page.
*/
function render(view, container) {
	const scope = new Scope(null);
	const fragment = document.createDocumentFragment();
	const start = fragment.appendChild(document.createComment(""));
	const end = fragment.appendChild(document.createComment(""));
	try {
		scope.run(() => insert(fragment, untrack(view), end));
	} catch (error) {
		scope.dispose();
		throw error;
	}
	container.appendChild(fragment);
	return () => {
		scope.dispose();
		removeBetween(start, end);
		start.parentNode?.removeChild(start);
		end.parentNode?.removeChild(end);
	};
}
export { ERRORS, Fragment, VIEW, h, insert, render, templateOf, withNamespaceOf };
