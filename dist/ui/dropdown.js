import { Scope, getScope, onCleanup, state, untrack } from "../reactive/reactive.js";
import { insert } from "./dom.js";
import { classes, currentTheme } from "./theme.js";
import { placePopover } from "./messages.js";
import { jsx } from "../jsx-runtime.js";
// src/ui/dropdown.tsx
/**
* A button with a panel of any content: a menu of the user, notifications, a filter.
* The panel is placed like the popover of confirm(), so a scrolled container does not clip it.
*/
/** An item of a Dropdown menu, with the theme slot `dropdown.item`: a link with `href`, otherwise a button. */
function DropdownItem(props) {
	const theme = currentTheme();
	const read = (value) => typeof value === "function" ? value() : value;
	const css = () => classes(theme.class("dropdown.item"), read(props.active) && theme.class("dropdown.itemActive"), props.class);
	const current = () => read(props.active) ? "true" : null;
	return props.href !== void 0 ? /* @__PURE__ */ jsx("a", {
		href: props.href,
		class: css,
		"aria-current": current,
		onClick: (event) => props.onClick?.(event),
		children: props.children
	}) : /* @__PURE__ */ jsx("button", {
		type: "button",
		class: css,
		"aria-pressed": current,
		disabled: () => Boolean(read(props.disabled)),
		onClick: (event) => props.onClick?.(event),
		children: props.children
	});
}
/**
* The panel opens by a click on the button. A click on a link or a button inside it, a click outside it
* and Escape close it; then the focus goes back to the button. The content is created anew on every opening.
*/
function Dropdown(props) {
	const owner = getScope();
	const theme = currentTheme();
	const opened = state(false);
	let button;
	let close = () => {};
	const open = () => {
		const scope = new Scope(owner);
		const panel = document.createElement("div");
		panel.className = classes(theme.class("dropdown.panel"), props.panelClass);
		scope.run(() => insert(panel, props.children, null));
		(button.closest("dialog") ?? document.body).append(panel);
		const place = () => {
			Object.assign(panel.style, {
				position: "fixed",
				margin: "0"
			});
			const { top, left, y } = placePopover(button, panel, props.placement ?? "bottom-left");
			Object.assign(panel.style, {
				top: `${top}px`,
				left: `${left}px`
			});
			panel.dataset.placement = y;
		};
		const outside = (event) => {
			if (!panel.contains(event.target) && !button.contains(event.target)) close();
		};
		const keydown = (event) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			event.stopPropagation();
			close();
			button.focus();
		};
		const click = (event) => {
			if (event.target.closest("a, button")) queueMicrotask(close);
		};
		close = () => {
			close = () => {};
			opened.set(false);
			window.removeEventListener("scroll", place, true);
			window.removeEventListener("resize", place);
			document.removeEventListener("pointerdown", outside, true);
			scope.dispose();
			panel.remove();
		};
		place();
		window.addEventListener("scroll", place, true);
		window.addEventListener("resize", place);
		document.addEventListener("pointerdown", outside, true);
		panel.addEventListener("keydown", keydown);
		panel.addEventListener("click", click);
		opened.set(true);
		props.onOpen?.();
		panel.querySelector("a[href], button, input, select, textarea, [tabindex]")?.focus();
	};
	onCleanup(() => close());
	return /* @__PURE__ */ jsx("button", {
		type: "button",
		class: () => classes(theme.class("dropdown.button"), typeof props.class === "function" ? props.class() : props.class),
		title: props.title ?? null,
		"aria-label": props.title ?? null,
		"aria-haspopup": "true",
		"aria-expanded": () => String(opened()),
		ref: (element) => {
			button = element;
		},
		onClick: () => untrack(opened) ? close() : open(),
		children: props.label
	});
}
export { Dropdown, DropdownItem };
