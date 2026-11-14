import { h, insert } from "./dom.js";
import { renderComponent } from "./component.js";
import { currentTheme } from "./theme.js";
import { allowsMotion } from "./motion.js";
// src/ui/dialog.ts
/** Windows for dialogs. The service is replaceable, an adapter can show dialogs in Kendo Window instead. */
var Dialogs = class {};
/**
* Uses the native <dialog> element, without any dependency. Classes come from the theme, the animations
* of opening and closing (and of the backdrop) are in styles/base.css and follow setMotion().
*/
var NativeDialogs = class extends Dialogs {
	show(dialog, options = {}) {
		const element = document.createElement("dialog");
		element.addEventListener("cancel", (event) => {
			event.preventDefault();
			dialog.cancel();
		});
		let pressedOutside = false;
		const outside = (event) => event.target === element && !element.firstElementChild?.contains(event.target);
		element.addEventListener("pointerdown", (event) => {
			pressedOutside = outside(event);
		});
		element.addEventListener("click", (event) => {
			if (pressedOutside && outside(event)) dialog.cancel();
			pressedOutside = false;
		});
		dialog.scope.run(() => {
			const theme = currentTheme();
			element.className = [theme.class("dialog"), options.class].filter(Boolean).join(" ");
			if (options.placement && options.placement !== "center") element.dataset.placement = options.placement;
			insert(element, h("div", { class: theme.class("dialogContent") }, h("header", { class: theme.class("dialogHeader") }, h("h2", { class: theme.class("dialogTitle") }, () => dialog.title()), h("button", {
				type: "button",
				class: theme.class("dialogClose"),
				"aria-label": "Close",
				onClick: () => void dialog.cancel()
			}, theme.closeText)), h("div", { class: theme.class("dialogBody") }, renderComponent(dialog)), h("footer", { class: theme.class("dialogFooter") }, () => dialog.actions())), null);
		});
		document.body.append(element);
		if (typeof element.showModal === "function") element.showModal();
		else element.setAttribute("open", "");
		focusFirst(element);
		return () => closeAnimated(element);
	}
};
/**
* The browser would focus the first button, which is × in the header. As in Bootstrap the focus goes
* to the first field of the body instead, or to the window itself. An element with autofocus wins.
*/
function focusFirst(element) {
	if (element.querySelector("[autofocus]")) return;
	const field = element.querySelector(":scope > div > div :is(input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [role=combobox])");
	if (field) {
		field.focus();
		return;
	}
	element.tabIndex = -1;
	element.focus();
}
/** Plays the closing animation of base.css, then removes the window. Without animations at once. */
function closeAnimated(element) {
	if (!allowsMotion() || typeof element.getAnimations !== "function") {
		element.remove();
		return;
	}
	element.classList.add("phlox-closing");
	const running = element.getAnimations();
	const timer = setTimeout(() => element.remove(), 400);
	Promise.allSettled(running.map((animation) => animation.finished)).then(() => {
		clearTimeout(timer);
		element.remove();
	});
}
export { Dialogs, NativeDialogs };
