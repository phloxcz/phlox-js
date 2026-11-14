import { allowsMotion } from "./motion.js";
// src/ui/drag.ts
/**
* The base of dragging, shared by dragToSort() and the tree: it follows one pointer from a pointerdown
* until it is let go, and scrolls when the pointer is held near an edge.
*/
/** How close to the edge the pointer must be to scroll, and the fastest scrolling, in px per frame. */
var EDGE = 48;
var SPEED = 16;
/**
* Follows the pointer of a pointerdown. Near an edge it scrolls the nearest scrolling element around
* `inside` (a list, a dialog, or the page), faster the closer the pointer is.
*/
function followPointer(event, inside, options) {
	const pointer = event.pointerId;
	let last = {
		x: event.clientX,
		y: event.clientY
	};
	const scroller = scrollerOf(inside);
	const max = {
		x: scroller.scrollWidth - scroller.clientWidth,
		y: scroller.scrollHeight - scroller.clientHeight
	};
	let frame = 0;
	const onMove = (move) => {
		if (move.pointerId !== pointer) return;
		last = {
			x: move.clientX,
			y: move.clientY
		};
		options.move(last);
	};
	const scroll = () => {
		const area = scroller === document.scrollingElement ? {
			top: 0,
			left: 0,
			bottom: window.innerHeight,
			right: window.innerWidth
		} : scroller.getBoundingClientRect();
		const was = {
			x: scroller.scrollLeft,
			y: scroller.scrollTop
		};
		scroller.scrollTop = Math.max(0, Math.min(max.y, was.y + speed(last.y, area.top, area.bottom)));
		scroller.scrollLeft = Math.max(0, Math.min(max.x, was.x + speed(last.x, area.left, area.right)));
		if (scroller.scrollTop !== was.y || scroller.scrollLeft !== was.x) options.move(last);
		frame = requestAnimationFrame(scroll);
	};
	const finish = (cancelled) => {
		cancelAnimationFrame(frame);
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onCancel);
		window.removeEventListener("keydown", onKey, true);
		options.end(cancelled);
	};
	const onUp = (up) => {
		if (up.pointerId === pointer) finish(false);
	};
	const onCancel = (cancel) => {
		if (cancel.pointerId === pointer) finish(true);
	};
	const onKey = (key) => {
		if (key.key !== "Escape") return;
		key.preventDefault();
		key.stopPropagation();
		finish(true);
	};
	window.addEventListener("pointermove", onMove);
	window.addEventListener("pointerup", onUp);
	window.addEventListener("pointercancel", onCancel);
	window.addEventListener("keydown", onKey, true);
	frame = requestAnimationFrame(scroll);
}
/** The nearest element that scrolls the given one: a scrolling list, a dialog, or the page. */
function scrollerOf(element) {
	for (let parent = element.parentElement; parent; parent = parent.parentElement) {
		const style = getComputedStyle(parent);
		if (/auto|scroll/.test(style.overflowY + style.overflowX) && (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth)) return parent;
	}
	return document.scrollingElement ?? document.documentElement;
}
/** Scrolling in one axis: back near the start of the area, forward near its end, nothing between. */
function speed(at, start, end) {
	if (at < start + EDGE) return -Math.round(SPEED * Math.min(1, (start + EDGE - at) / EDGE));
	if (at > end - EDGE) return Math.round(SPEED * Math.min(1, (at - end + EDGE) / EDGE));
	return 0;
}
/** Animates an element from a shift back to its place, when animations are on (see setMotion). */
function slide(element, from, duration = 150) {
	if (!allowsMotion()) return;
	element.animate?.([{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: "none" }], {
		duration,
		easing: "ease-out"
	});
}
export { followPointer, slide };
