import { followPointer, slide } from "./drag.js";
// src/ui/sortable.ts
/**
* Ordering by dragging. Built on pointer events, so it works with a mouse, a pen and a finger,
* without the HTML5 drag & drop, which does not work on touch screens and cannot be styled.
*
* The dragged item follows the pointer. It also moves in the data while it is dragged: the template
* moves its element, the other items slide out of its way, and when it is let go it settles in its place.
*
* With `lists` it can also go to other lists, e.g. to another level of a tree of boxes. Over such a list
* it does not move in the data (another template would make a new element for it): the list is marked,
* a line shows the place, and when it is let go there, the list's drop() moves it in the data.
*/
/** Class of the dragged item while it is dragged. */
var DRAGGING = "phlox-dragging";
/** Class of another list while the dragged item is over it, and of the line that shows the place. */
var DROP_TARGET = "phlox-drop-target";
var MARKER = "phlox-drop-marker";
var middle = (box) => ({
	x: box.left + box.width / 2,
	y: box.top + box.height / 2
});
/** Whether an item with the middle `other` and the box `box` lies before the point `at` in the layout. */
function isBefore(layout, other, box, at) {
	if (layout === "horizontal") return other.x < at.x;
	if (layout === "grid") return other.y < at.y - box.height / 2 || Math.abs(other.y - at.y) <= box.height / 2 && other.x < at.x;
	return other.y < at.y;
}
/** How many of `items` lie before the point in the layout: the position among them. */
function positionAmong(items, layout, at) {
	return items.filter((other) => {
		const box = other.getBoundingClientRect();
		return isBefore(layout, middle(box), box, at);
	}).length;
}
/**
* Starts dragging `item` from a pointerdown on its handle:
* <button onPointerdown={event => dragToSort(event, rowElement, { items, move })}>.
* The position is chosen by the middle of the dragged item against the middles of the others.
* Near an edge the list scrolls, see followPointer().
*/
function dragToSort(event, item, options) {
	if (event.button !== 0) return;
	event.preventDefault();
	const { layout = "vertical", lockAxis = false, anchor = "middle" } = options;
	const start = item.getBoundingClientRect();
	const grab = {
		x: event.clientX - start.left,
		y: event.clientY - start.top
	};
	const shift = {
		x: 0,
		y: 0
	};
	let last = {
		x: event.clientX,
		y: event.clientY
	};
	/** Another list the item is over now, and its position there */
	let other = null;
	let marker = null;
	item.classList.add(DRAGGING);
	/** Moves the item under the pointer: its place in the layout plus a shift by transform. */
	const follow = () => {
		const box = item.getBoundingClientRect();
		const place = {
			x: box.left - shift.x,
			y: box.top - shift.y
		};
		shift.x = lockAxis && layout === "vertical" ? 0 : last.x - grab.x - place.x;
		shift.y = lockAxis && layout === "horizontal" ? 0 : last.y - grab.y - place.y;
		item.style.transform = `translate(${shift.x}px, ${shift.y}px)`;
	};
	/** The point compared with the middles of the other items. */
	const at = () => anchor === "pointer" ? last : middle(item.getBoundingClientRect());
	/** The innermost list under the pointer: its own ('home'), another one, or null when over none. */
	const listUnder = (pointer) => {
		const lists = (options.lists?.() ?? []).filter((list) => !item.contains(list.element));
		for (const element of document.elementsFromPoint?.(pointer.x, pointer.y) ?? []) {
			if (item.contains(element)) continue;
			if (element === options.list) return "home";
			const list = lists.find((candidate) => candidate.element === element);
			if (list) return list;
		}
		return null;
	};
	/** Marks another list and draws a line where the item would go, or removes both. */
	const mark = (next) => {
		if (other && other.list !== next?.list) other.list.element.classList.remove(DROP_TARGET);
		other = next;
		if (!next) {
			marker?.remove();
			marker = null;
			return;
		}
		next.list.element.classList.add(DROP_TARGET);
		marker ??= document.body.appendChild(Object.assign(document.createElement("div"), { className: MARKER }));
		const items = next.list.items().filter((element) => element !== item);
		const across = (next.list.layout ?? "vertical") === "horizontal";
		const area = next.list.element.getBoundingClientRect();
		const box = (items[next.to] ?? items[next.to - 1])?.getBoundingClientRect();
		const edge = !box ? across ? area.left : area.top : next.to < items.length ? across ? box.left : box.top : across ? box.right : box.bottom;
		Object.assign(marker.style, across ? {
			left: `${edge - 2}px`,
			top: `${box?.top ?? area.top}px`,
			width: "3px",
			height: `${box?.height ?? area.height}px`
		} : {
			left: `${box?.left ?? area.left}px`,
			top: `${edge - 2}px`,
			width: `${box?.width ?? area.width}px`,
			height: "3px"
		});
	};
	/** Moves the item under the pointer and to its place in the order. */
	const update = (pointer) => {
		last = pointer;
		follow();
		const target = options.lists ? listUnder(pointer) : "home";
		if (target && target !== "home") {
			const items = target.items().filter((element) => element !== item);
			return mark({
				list: target,
				to: positionAmong(items, target.layout, at())
			});
		}
		if (target === "home") mark(null);
		if (other) return;
		const items = options.items();
		const others = items.filter((element) => element !== item);
		const before = positionAmong(others, layout, at());
		if (before === items.indexOf(item)) return;
		const old = new Map(others.map((element) => [element, element.getBoundingClientRect()]));
		options.move(before);
		follow();
		for (const element of others) {
			const was = old.get(element);
			const now = element.getBoundingClientRect();
			if (was.left !== now.left || was.top !== now.top) slide(element, {
				x: was.left - now.left,
				y: was.top - now.top
			});
		}
	};
	followPointer(event, item, {
		move: update,
		end: (cancelled) => {
			const dropped = other;
			mark(null);
			item.classList.remove(DRAGGING);
			item.style.transform = "";
			if (dropped && !cancelled) dropped.list.drop(dropped.to);
			else if (shift.x || shift.y) slide(item, shift);
			options.done?.();
		}
	});
}
export { DRAGGING, DROP_TARGET, dragToSort };
