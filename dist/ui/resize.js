import { untrack } from "../reactive/reactive.js";
import { jsx } from "../jsx-runtime.js";
// src/ui/resize.tsx
/**
* A handle at the edge of an element that changes its width: a column of a layout, a side panel.
* The width is a state, so with Component.preference() it is remembered.
*/
/** How far one press of an arrow key moves the edge, with Shift four times as far. */
var STEP = 16;
/**
* Put it as the last child of the element whose width it changes; base.css positions that element.
* Dragging by the mouse or a finger, Escape during dragging returns the width. With the focus on it
* arrows change the width, Home and End set the smallest and the largest.
*/
function ResizeHandle(props) {
	const min = props.min ?? 0;
	const max = props.max ?? Number.POSITIVE_INFINITY;
	const sign = props.edge === "start" ? -1 : 1;
	const clamp = (width) => Math.round(Math.min(max, Math.max(min, width)));
	let handle;
	const drag = (event) => {
		if (event.button !== 0) return;
		event.preventDefault();
		const start = event.clientX;
		const from = untrack(props.size);
		const pointer = event.pointerId;
		const root = document.documentElement;
		handle.classList.add("phlox-resizing");
		root.classList.add("phlox-col-resizing");
		const move = (next) => {
			if (next.pointerId === pointer) props.size.set(clamp(from + sign * (next.clientX - start)));
		};
		const finish = (cancelled) => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			window.removeEventListener("pointercancel", cancel);
			window.removeEventListener("keydown", escape, true);
			handle.classList.remove("phlox-resizing");
			root.classList.remove("phlox-col-resizing");
			if (cancelled) props.size.set(from);
		};
		const up = () => finish(false);
		const cancel = () => finish(true);
		const escape = (key) => {
			if (key.key !== "Escape") return;
			key.preventDefault();
			key.stopPropagation();
			finish(true);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
		window.addEventListener("pointercancel", cancel);
		window.addEventListener("keydown", escape, true);
	};
	const keydown = (event) => {
		const step = event.shiftKey ? 64 : STEP;
		const width = untrack(props.size);
		const next = event.key === "ArrowRight" ? width + sign * step : event.key === "ArrowLeft" ? width - sign * step : event.key === "Home" ? min : event.key === "End" && Number.isFinite(max) ? max : null;
		if (next === null) return;
		event.preventDefault();
		props.size.set(clamp(next));
	};
	return /* @__PURE__ */ jsx("div", {
		class: `phlox-resize-handle phlox-resize-${props.edge ?? "end"}`,
		role: "separator",
		"aria-orientation": "vertical",
		"aria-label": props.label ?? null,
		"aria-valuenow": props.size,
		"aria-valuemin": min,
		"aria-valuemax": Number.isFinite(max) ? max : null,
		tabIndex: 0,
		ref: (element) => {
			handle = element;
		},
		onPointerdown: drag,
		onKeydown: keydown,
		onDblclick: () => {
			if (props.initial !== void 0) props.size.set(clamp(props.initial));
		}
	});
}
export { ResizeHandle };
