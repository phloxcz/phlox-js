import { Else, For, If } from "../ui/flow.js";
import { effect, onCleanup, state, untrack } from "../reactive/reactive.js";
import { classes } from "../ui/theme.js";
import { FormControl, toPairs } from "./controls.js";
import { jsx } from "../jsx-runtime.js";
// src/forms/listbox.tsx
/**
* What DropDownList and ComboBox share: items, loading them, the list with highlighted text,
* moving through it by the keyboard and placing the panel next to the control.
*/
/** How long typing has to pause before `search` is called. */
var DEBOUNCE_MS = 250;
var lastList = 0;
/**
* Text for searching: lower case and without diacritics, so 'nap' finds 'Nápoje'.
* Character by character, so positions in it are positions in the original text.
*/
function foldText(text) {
	return text.split("").map((char) => char.normalize("NFD")[0].toLowerCase()).join("");
}
/** Items as pairs of value and label. Objects (with `itemValue`) are remembered by their values for the template. */
function itemPairs(items, options, objects) {
	const { itemValue, itemLabel } = options;
	if (!itemValue) return toPairs(items);
	return items.map((item) => {
		const value = itemValue(item);
		objects.set(value, item);
		return [value, itemLabel?.(item) ?? String(value)];
	});
}
/** The label of a value given by a text or by an item object, which is remembered for the template. */
function labelOf(value, given, options, objects) {
	if (typeof given === "string" || !options.itemValue) return String(given);
	objects.set(value, given);
	return options.itemLabel?.(given) ?? String(value);
}
/** Is the item of this value disabled by `itemDisabled`? For objects, the object must be known (loaded or given). */
function isDisabledItem(value, options, objects) {
	if (!options.itemDisabled) return false;
	if (!options.itemValue) return options.itemDisabled(value);
	return objects.has(value) && options.itemDisabled(objects.get(value));
}
/** The index next to `from` in the direction, skipping disabled items; `from` when there is none. `wrap` goes round. */
function nextIndex(count, from, step, disabled, wrap = false) {
	for (let i = 1; i <= count; i++) {
		let index = from + step * i;
		if (wrap) index = (index % count + count) % count;
		else if (index < 0 || index >= count) return from;
		if (!disabled(index)) return index;
	}
	return from;
}
/** The template of a known item object, otherwise the text. */
function itemContent(value, text, options, objects) {
	return options.template && objects.has(value) ? options.template(objects.get(value)) : text;
}
var ListControl = class extends FormControl {
	options;
	selected = state(null);
	/** Label of the selected value. */
	selectedLabel = state("");
	opened = state(false);
	items = state([]);
	/** Index of the item highlighted by the keyboard, -1 for none. */
	active = state(-1);
	/** The text the items are searched by. */
	query = state("");
	placeholder;
	listId;
	/** Item objects by their values, see ItemOptions. */
	objects = /* @__PURE__ */ new Map();
	all = [];
	request = 0;
	timer;
	constructor(label, options, idPrefix) {
		super(label);
		this.options = options;
		this.listId = `${idPrefix}${++lastList}`;
		this.placeholder = options.placeholder ?? "";
		if (options.items) this.setItems(options.items);
	}
	setItems(items) {
		this.all = itemPairs(items, this.options, this.objects);
		return this;
	}
	setPlaceholder(placeholder) {
		this.placeholder = placeholder;
		return this;
	}
	getValue() {
		return this.selected();
	}
	/**
	* Sets the value. The label (or the item object) can be given, e.g. when the data from the server have it
	* already, otherwise it comes from the items, or from the `label` option.
	*/
	setValue(value, label) {
		this.selected.set(value ?? null);
		if (value === null || value === void 0) {
			this.selectedLabel.set("");
			return;
		}
		if (label !== void 0) {
			this.selectedLabel.set(labelOf(value, label, this.options, this.objects));
			return;
		}
		const known = this.findItem(value);
		if (known) {
			this.selectedLabel.set(known[1]);
			return;
		}
		this.selectedLabel.set(String(value));
		Promise.resolve(this.options.label?.(value) ?? null).then((label) => {
			if (label !== null && Object.is(untrack(this.selected), value)) this.selectedLabel.set(labelOf(value, label, this.options, this.objects));
		});
	}
	isFilled() {
		return this.selected() !== null;
	}
	close() {
		this.opened.set(false);
		this.active.set(-1);
	}
	/** Is the item disabled by the option `itemDisabled`? It is shown in the list but cannot be picked. */
	isItemDisabled(value) {
		return isDisabledItem(value, this.options, this.objects);
	}
	/** Can the user change the value now: not disabled, not read-only. */
	changeable() {
		return !untrack(this.disabled) && !untrack(this.readOnly);
	}
	/** Selects an item from the list and closes it. A disabled item is not picked. */
	pick(value, label) {
		if (this.isItemDisabled(value)) return;
		this.selected.set(value);
		this.selectedLabel.set(label);
		this.close();
		this.changed();
	}
	findItem(value) {
		return [...this.all, ...untrack(this.items)].find(([item]) => Object.is(item, value));
	}
	/** Searches for the text: fixed items at once, `search` after a pause in typing. */
	searchFor(text) {
		this.query.set(text);
		this.active.set(-1);
		clearTimeout(this.timer);
		const query = text.trim();
		if (this.options.search) this.timer = setTimeout(() => void this.load(query), DEBOUNCE_MS);
		else this.load(query);
	}
	/** Fixed items are filtered here, otherwise `search` is asked. An older answer never overwrites a newer one. */
	async load(query) {
		clearTimeout(this.timer);
		const request = ++this.request;
		let items;
		if (this.options.search) items = itemPairs(await this.options.search(query), this.options, this.objects);
		else {
			const folded = foldText(query);
			items = this.all.filter(([, label]) => foldText(label).includes(folded));
		}
		if (request !== this.request) return;
		const selected = untrack(this.selected);
		if (query === "" && selected !== null && !items.some(([item]) => Object.is(item, selected))) items = [[selected, untrack(this.selectedLabel)], ...items];
		this.items.set(items);
		this.active.set(-1);
	}
	/** Arrow keys move the highlight, over disabled items. Returns whether the key was one of them. */
	moveActive(event, stopAtFirst = false) {
		const items = untrack(this.items);
		const active = untrack(this.active);
		const disabled = (index) => this.isItemDisabled(items[index][0]);
		if (event.key === "ArrowDown") this.active.set(nextIndex(items.length, active, 1, disabled));
		else if (event.key === "ArrowUp") {
			const up = nextIndex(items.length, active, -1, disabled);
			this.active.set(up !== active || stopAtFirst ? up : -1);
		} else return false;
		event.preventDefault();
		return true;
	}
	/** The highlighted item, if any. */
	activeItem() {
		return untrack(this.items)[untrack(this.active)];
	}
	/** Items of the list, or a line saying there are none. `slot` gives classes of the theme. */
	renderItems(slot, noResults) {
		return /* @__PURE__ */ jsx(If, {
			when: () => this.items().length,
			children: [
				/* @__PURE__ */ jsx(For, {
					each: this.items,
					children: ([value, label], index) => /* @__PURE__ */ jsx("li", {
						role: "option",
						id: () => `${this.listId}-${index()}`,
						"aria-selected": () => String(Object.is(this.selected(), value)),
						"aria-disabled": this.isItemDisabled(value) ? "true" : null,
						"data-value": String(value),
						class: () => classes(slot("item"), this.active() === index() && slot("itemActive"), Object.is(this.selected(), value) && slot("itemSelected")) || null,
						ref: (item) => this.scrollWhenActive(item, index),
						onMousedown: (event) => {
							event.preventDefault();
							this.pick(value, label);
						},
						children: itemContent(value, () => highlight(label, this.query().trim(), slot("mark")), this.options, this.objects)
					})
				}),
				/* @__PURE__ */ jsx(Else, {}),
				/* @__PURE__ */ jsx("li", {
					role: "option",
					"aria-disabled": "true",
					class: slot("noResults"),
					children: noResults()
				})
			]
		});
	}
	/** Cleans up a pending search. Call it while rendering. */
	cleanUpSearch() {
		onCleanup(() => clearTimeout(this.timer));
	}
	/** Keeps the highlighted and the selected item in view. */
	scrollWhenActive(item, index) {
		effect(() => {
			if (this.active() === index() || this.active() < 0 && item.getAttribute("aria-selected") === "true") item.scrollIntoView?.({ block: "nearest" });
		});
	}
	/** Places the panel next to the control, see placePanel(). */
	place(panel, list) {
		placePanel(() => this.element, panel, list);
	}
};
/**
* Places the panel `fixed` next to the control. Unlike `absolute` in the PHP versions,
* a dialog or another scrolling container around it does not cut it off.
*
* It opens below. When the whole list would not fit there and there is more room above,
* it opens above. When it fits on neither side, the list gets shorter. The side is chosen by the
* full height of the list, not by the items shown now, so it does not jump while the user types.
* `list` is the scrolling part of the panel, or the panel itself.
*/
function placePanel(anchorOf, panel, list) {
	const GAP = 2;
	const update = () => {
		const anchor = anchorOf()?.getBoundingClientRect();
		if (!anchor) return;
		list.style.maxHeight = "";
		const style = getComputedStyle(list);
		const listChrome = [
			"paddingTop",
			"paddingBottom",
			"borderTopWidth",
			"borderBottomWidth"
		].reduce((sum, name) => sum + (Number.parseFloat(style[name]) || 0), 0);
		const rest = panel.offsetHeight - list.offsetHeight + listChrome;
		const needed = rest + (Number.parseFloat(style.maxHeight) || 200);
		const below = window.innerHeight - anchor.bottom - 4;
		const above = anchor.top - 4;
		const up = below < needed && above > below;
		const room = up ? above : below;
		if (room < needed) list.style.maxHeight = `${Math.max(room - rest, 60)}px`;
		panel.dataset.placement = up ? "top" : "bottom";
		Object.assign(panel.style, {
			display: "block",
			position: "fixed",
			top: up ? "auto" : `${anchor.bottom + GAP}px`,
			bottom: up ? `${window.innerHeight - anchor.top + GAP}px` : "auto",
			left: `${anchor.left}px`,
			width: `${anchor.width}px`,
			margin: "0"
		});
	};
	update();
	if (typeof requestAnimationFrame === "function") requestAnimationFrame(update);
	else setTimeout(update);
	window.addEventListener("scroll", update, true);
	window.addEventListener("resize", update);
	onCleanup(() => {
		window.removeEventListener("scroll", update, true);
		window.removeEventListener("resize", update);
	});
}
/** The label with the searched text in <mark>, as text, never as HTML. Diacritics do not matter. */
function highlight(label, query, markClass) {
	const at = query ? foldText(label).indexOf(foldText(query)) : -1;
	if (at < 0) return label;
	return [
		label.slice(0, at),
		/* @__PURE__ */ jsx("mark", {
			class: markClass || null,
			children: label.slice(at, at + query.length)
		}),
		label.slice(at + query.length)
	];
}
export { ListControl, foldText, highlight, isDisabledItem, itemContent, itemPairs, labelOf, nextIndex, placePanel, toPairs };
