import { For, If } from "./flow.js";
import { Scope, effect, state, untrack } from "../reactive/reactive.js";
import { h, insert } from "./dom.js";
import { Component } from "./component.js";
import { THEME, classes, currentTheme } from "./theme.js";
import { allowsMotion } from "./motion.js";
import { texts } from "./texts.js";
import { jsx } from "../jsx-runtime.js";
// src/ui/messages.tsx
/**
* Messages for the user, taken over from @phloxcz/capify: alert, confirm and prompt as a dialog or as a popover
* at an element, a dialog while something loads, and toasts for flash messages. Classes come from the theme,
* so they follow Bootstrap, the dark mode and setMotion() like the rest of the framework.
*/
var messageTexts = texts("messages", {
	ok: "OK",
	cancel: "Cancel",
	close: "Close",
	loading: "Loading…",
	/** The question before leaving unsaved changes and its button. */
	unsaved: "Leave without saving the changes?",
	leave: "Leave"
});
/** The content of alert, confirm and prompt in a dialog of the framework. */
var MessageBox = class extends Component {
	value = state(this.props.options.value ?? "");
	title() {
		return this.props.options.title ?? "";
	}
	actions() {
		const { kind, options } = this.props;
		const theme = currentTheme();
		const careful = kind === "confirm" && Boolean(options.danger);
		return [kind === "alert" ? null : /* @__PURE__ */ jsx("button", {
			type: "button",
			class: theme.class("message.cancel"),
			autofocus: careful,
			onClick: () => this.close(),
			children: options.cancelText ?? messageTexts.cancel
		}), /* @__PURE__ */ jsx("button", {
			type: "button",
			class: theme.class(options.danger ? "message.okDanger" : "message.ok"),
			autofocus: kind !== "prompt" && !careful,
			onClick: () => this.close(kind === "prompt" ? untrack(this.value) : true),
			children: options.okText ?? messageTexts.ok
		})];
	}
	render() {
		const theme = currentTheme();
		return /* @__PURE__ */ jsx("div", {
			class: theme.class("message.body"),
			children: [/* @__PURE__ */ jsx("div", {
				class: theme.class("message.text"),
				children: this.props.message
			}), this.props.kind === "prompt" ? /* @__PURE__ */ jsx("input", {
				type: "text",
				class: theme.class("message.input"),
				value: this.value,
				placeholder: this.props.options.placeholder ?? null,
				autofocus: true,
				onInput: (event) => this.value.set(event.currentTarget.value),
				onKeydown: (event) => {
					if (event.key !== "Enter") return;
					event.preventDefault();
					this.close(untrack(this.value));
				}
			}) : null]
		});
	}
};
/** Shows alert, confirm or prompt as a dialog opened by the component, or as a popover with `anchor`. */
async function showMessage(opener, kind, message, options = {}) {
	const result = options.anchor ? await showPopover(opener.scope, kind, message, options) : await opener.openDialog(MessageBox, {
		kind,
		message,
		options
	});
	if (kind === "alert") return true;
	if (kind === "confirm") return result === true;
	return typeof result === "string" ? result : null;
}
var GAP = 8;
/** Where a popover goes: under or above the element, aligned to its left or right, turned over when it does not fit. */
function placePopover(anchor, popover, placement) {
	const box = anchor.getBoundingClientRect();
	const width = popover.offsetWidth;
	const height = popover.offsetHeight;
	let [y, x] = placement.split("-");
	if (y === "bottom" && box.bottom + GAP + height > window.innerHeight && box.top - GAP - height > 0) y = "top";
	else if (y === "top" && box.top - GAP - height < 0 && box.bottom + GAP + height < window.innerHeight) y = "bottom";
	if (x === "left" && box.left + width > window.innerWidth && box.right - width > 0) x = "right";
	else if (x === "right" && box.right - width < 0 && box.left + width < window.innerWidth) x = "left";
	const top = Math.max(8, Math.min(y === "bottom" ? box.bottom + GAP : box.top - GAP - height, window.innerHeight - height - 8));
	const left = Math.max(8, Math.min(x === "left" ? box.left : box.right - width, window.innerWidth - width - 8));
	const arrow = Math.max(12, Math.min(box.left + box.width / 2 - left, width - 12));
	return {
		top,
		left,
		y,
		arrow
	};
}
var lastPopover = 0;
/** A small dialog at an element. Escape, a click outside or Cancel closes it; the focus goes back to the element. */
function showPopover(owner, kind, message, options) {
	const anchor = options.anchor;
	const scope = new Scope(owner);
	const host = document.createElement("div");
	const id = `phlox-popover-${++lastPopover}`;
	const value = state(options.value ?? "");
	return new Promise((resolve) => {
		let popover;
		const close = (result) => {
			window.removeEventListener("scroll", place, true);
			window.removeEventListener("resize", place);
			document.removeEventListener("pointerdown", outside, true);
			scope.dispose();
			host.remove();
			anchor.focus();
			resolve(result);
		};
		const cancel = () => close(kind === "confirm" ? false : null);
		const ok = () => close(kind === "prompt" ? untrack(value) : true);
		const place = () => {
			Object.assign(popover.style, {
				position: "fixed",
				margin: "0"
			});
			const { top, left, y, arrow } = placePopover(anchor, popover, options.placement ?? "bottom-left");
			Object.assign(popover.style, {
				top: `${top}px`,
				left: `${left}px`
			});
			popover.dataset.placement = y;
			popover.style.setProperty("--phlox-arrow", `${arrow}px`);
			const theme = untrack(() => scope.find(THEME));
			const sides = theme?.class("popover.side") ?? "";
			if (sides) popover.className = classes(theme.class("popover.wrap"), sides.replace("%s", y));
		};
		const outside = (event) => {
			if (!popover.contains(event.target) && !anchor.contains(event.target)) cancel();
		};
		scope.run(() => {
			const theme = currentTheme();
			insert(host, /* @__PURE__ */ jsx("div", {
				class: theme.class("popover.wrap"),
				role: kind === "confirm" ? "alertdialog" : "dialog",
				"aria-labelledby": id,
				ref: (element) => {
					popover = element;
				},
				onKeydown: (event) => {
					if (event.key !== "Escape") return;
					event.preventDefault();
					event.stopPropagation();
					cancel();
				},
				children: [/* @__PURE__ */ jsx("div", { class: theme.class("popover.arrow") }), /* @__PURE__ */ jsx("div", {
					class: theme.class("popover.body"),
					children: [
						/* @__PURE__ */ jsx("div", {
							class: theme.class("popover.label"),
							id,
							children: message
						}),
						kind === "prompt" ? /* @__PURE__ */ jsx("input", {
							type: "text",
							class: theme.class("popover.input"),
							value,
							placeholder: options.placeholder ?? null,
							"aria-labelledby": id,
							onInput: (event) => value.set(event.currentTarget.value),
							onKeydown: (event) => {
								if (event.key !== "Enter") return;
								event.preventDefault();
								ok();
							}
						}) : null,
						/* @__PURE__ */ jsx("div", {
							class: theme.class("popover.actions"),
							children: [kind === "alert" ? null : /* @__PURE__ */ jsx("button", {
								type: "button",
								class: theme.class("popover.cancel"),
								onClick: cancel,
								children: options.cancelText ?? messageTexts.cancel
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								class: theme.class(options.danger ? "popover.okDanger" : "popover.ok"),
								onClick: ok,
								children: options.okText ?? messageTexts.ok
							})]
						})
					]
				})]
			}), null);
		});
		(anchor.closest("dialog") ?? document.body).append(host);
		place();
		window.addEventListener("scroll", place, true);
		window.addEventListener("resize", place);
		document.addEventListener("pointerdown", outside, true);
		const careful = kind === "confirm" && options.danger;
		(popover.querySelector("input") ?? [...popover.querySelectorAll("button")].at(careful ? 0 : -1))?.focus();
	});
}
/**
* A dialog without buttons while something runs. It cannot be closed by the user, only by close().
* The message can be changed: handle.update('Saving 2 of 5…').
*/
function showLoading(owner, message = messageTexts.loading) {
	const scope = new Scope(owner);
	const text = state(message);
	const element = document.createElement("dialog");
	element.addEventListener("cancel", (event) => event.preventDefault());
	scope.run(() => {
		const theme = currentTheme();
		element.className = classes(theme.class("dialog"), "phlox-loading");
		element.setAttribute("aria-busy", "true");
		insert(element, h("div", { class: theme.class("dialogContent") }, h("div", {
			class: classes(theme.class("dialogBody"), theme.class("message.loading")),
			role: "status"
		}, h("span", {
			class: theme.class("message.spinner"),
			"aria-hidden": "true"
		}), h("span", null, () => text()))), null);
	});
	document.body.append(element);
	if (typeof element.showModal === "function") element.showModal();
	else element.setAttribute("open", "");
	return {
		update: (next) => text.set(next),
		close: () => {
			scope.dispose();
			element.remove();
		}
	};
}
/**
* Flash messages as toasts, like the notifications of capify: they stack in a corner, disappear by themselves
* with a bar of the remaining time, wait while the pointer or the focus is on them, and can be closed.
* The Application shows them; a layout that shows flash messages itself sets flashes.toasts = false.
*/
function Toasts(props) {
	const { flashes } = props;
	const theme = currentTheme();
	const slot = (name) => theme.class(`toast.${name}`);
	const shown = state([]);
	const leaving = state([]);
	effect(() => {
		const now = flashes.messages();
		untrack(() => {
			const gone = shown().filter((flash) => !now.includes(flash) && !leaving().includes(flash));
			shown.update((list) => [...list, ...now.filter((flash) => !list.includes(flash))]);
			if (!gone.length) return;
			const drop = () => {
				shown.update((list) => list.filter((flash) => !gone.includes(flash)));
				leaving.update((list) => list.filter((flash) => !gone.includes(flash)));
			};
			if (!allowsMotion()) return drop();
			leaving.update((list) => [...list, ...gone]);
			setTimeout(drop, 200);
		});
	});
	return /* @__PURE__ */ jsx("div", {
		class: classes("cap-notify-container", slot("container")),
		"data-pos": flashes.position,
		children: /* @__PURE__ */ jsx(For, {
			each: shown,
			children: (flash) => {
				const type = [
					"success",
					"warning",
					"error"
				].includes(flash.type) ? flash.type : "info";
				return /* @__PURE__ */ jsx("div", {
					class: () => classes("cap-notify", slot("card"), slot(type), leaving().includes(flash) && "cap-notify-exit"),
					"data-type": type,
					role: type === "error" ? "alert" : "status",
					onMouseenter: () => flashes.pause(flash),
					onMouseleave: () => flashes.resume(flash),
					onFocusin: () => flashes.pause(flash),
					onFocusout: () => flashes.resume(flash),
					children: [
						/* @__PURE__ */ jsx(If, {
							when: () => Boolean(flash.title),
							children: /* @__PURE__ */ jsx("div", {
								class: slot("title"),
								children: flash.title
							})
						}),
						/* @__PURE__ */ jsx("div", {
							class: slot("message"),
							children: flash.text
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							class: classes("cap-notify-close", slot("close")),
							"aria-label": messageTexts.close,
							onClick: () => flashes.remove(flash),
							children: theme.closeText
						}),
						flash.duration > 0 ? /* @__PURE__ */ jsx("div", {
							class: "cap-notify-progress",
							style: `animation-duration: ${flash.duration}ms`
						}) : null
					]
				});
			}
		})
	});
}
export { MessageBox, Toasts, messageTexts, placePopover, showLoading, showMessage };
