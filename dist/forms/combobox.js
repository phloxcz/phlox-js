import { If } from "../ui/flow.js";
import { state, untrack } from "../reactive/reactive.js";
import { classes, currentTheme } from "../ui/theme.js";
import { ListControl, foldText } from "./listbox.js";
import { texts } from "../ui/texts.js";
import { jsx } from "../jsx-runtime.js";
// src/forms/combobox.tsx
/**
* ComboBox: a text field with a list of suggestions, taken over from phloxcz/forms-combobox.
* The value is an item picked from the list. Typed text that is not an item is thrown away
* when the user leaves the field, unless `allowCustom` is on: then the typed text is the value.
*/
/** With item objects the template shows in the list only, the field shows the text of the item. */
var ComboBox = class ComboBox extends ListControl {
	options;
	/** Texts of the list. Replace them for the language of the application. */
	static texts = texts("combobox", { noResults: "No results" });
	/** True while the field shows what the user is typing, not the label of the value. */
	editing = state(false);
	previous = {
		value: null,
		label: "",
		custom: false
	};
	custom = false;
	constructor(label = "", options = {}) {
		super(label, options, "combobox");
		this.options = options;
	}
	/** Whether the value is a typed text, not an item. Only with `allowCustom`. */
	isCustom() {
		return this.custom;
	}
	setValue(value, label) {
		this.editing.set(false);
		this.custom = false;
		super.setValue(value, label);
	}
	pick(value, label) {
		this.editing.set(false);
		this.custom = false;
		super.pick(value, label);
	}
	/** The field gets the focus: the list opens with the first items, the current value is remembered for Escape. */
	open() {
		if (untrack(this.opened) || untrack(this.disabled)) return;
		this.remember();
		this.opened.set(true);
		this.load(untrack(this.editing) ? untrack(this.query) : "");
	}
	/** The value Escape returns to: the one before the list opened or before typing started. */
	remember() {
		if (untrack(this.editing)) return;
		this.previous = {
			value: untrack(this.selected),
			label: untrack(this.selectedLabel),
			custom: this.custom
		};
	}
	/** Escape: back to the value before editing. */
	restore() {
		this.editing.set(false);
		this.selected.set(this.previous.value);
		this.selectedLabel.set(this.previous.label);
		this.custom = this.previous.custom;
		this.close();
	}
	/**
	* Settles typed text: an item with exactly this label is picked, otherwise the text becomes the value
	* (with allowCustom), or it is thrown away and the previous value returns.
	*/
	commit() {
		if (!untrack(this.editing)) return;
		const typed = untrack(this.query).trim();
		const match = untrack(this.items).find(([, label]) => foldText(label) === foldText(typed));
		if (typed === "") {
			this.editing.set(false);
			this.custom = false;
			this.selected.set(null);
			this.selectedLabel.set("");
		} else if (match) this.pick(...match);
		else if (this.options.allowCustom) {
			this.editing.set(false);
			this.custom = true;
			this.selected.set(typed);
			this.selectedLabel.set(typed);
		} else this.restore();
	}
	/** Typed text is settled before the rules are checked, e.g. when Enter sends the form. */
	validate() {
		this.commit();
		return super.validate();
	}
	onKey(event) {
		const opened = untrack(this.opened);
		if (event.key === "ArrowDown" && !opened) {
			event.preventDefault();
			this.open();
			return;
		}
		if (opened && this.moveActive(event, true)) return;
		const item = opened ? this.activeItem() : void 0;
		switch (event.key) {
			case "Enter":
				if (item) {
					event.preventDefault();
					this.pick(...item);
				}
				break;
			case "Tab":
				if (item) this.pick(...item);
				else this.commit();
				this.close();
				break;
			case "Escape": if (opened) {
				event.preventDefault();
				event.stopPropagation();
				this.restore();
			}
		}
	}
	render(attributes) {
		const theme = currentTheme();
		const slot = (name) => theme.class(`combobox.${name}`);
		const { id, ref, onBlur, ...common } = this.attrs();
		let wrapper;
		this.cleanUpSearch();
		return /* @__PURE__ */ jsx("div", {
			class: classes(slot("wrapper"), attributes.class),
			ref: (element) => {
				wrapper = element;
			},
			onFocusout: (event) => {
				if (wrapper.contains(event.relatedTarget)) return;
				this.commit();
				this.close();
				onBlur(event);
			},
			children: [/* @__PURE__ */ jsx("input", {
				type: "text",
				...attributes,
				...common,
				id,
				ref,
				class: this.classFor({}, "combobox.input"),
				autocomplete: "off",
				role: "combobox",
				"aria-autocomplete": "list",
				"aria-haspopup": "listbox",
				"aria-expanded": () => String(this.opened()),
				"aria-controls": this.listId,
				"aria-activedescendant": () => this.opened() && this.active() >= 0 ? `${this.listId}-${this.active()}` : null,
				placeholder: this.placeholder || null,
				value: () => this.editing() ? this.query() : this.selectedLabel(),
				onFocus: () => this.open(),
				onClick: () => this.open(),
				onInput: (event) => {
					const text = event.currentTarget.value;
					this.remember();
					this.editing.set(true);
					this.custom = Boolean(this.options.allowCustom && text.trim());
					this.selected.set(this.custom ? text.trim() : null);
					this.opened.set(true);
					this.searchFor(text);
					this.changed();
				},
				onKeydown: (event) => this.onKey(event)
			}), /* @__PURE__ */ jsx(If, {
				when: this.opened,
				children: /* @__PURE__ */ jsx("ul", {
					role: "listbox",
					id: this.listId,
					class: slot("dropdown"),
					"data-combobox-panel": true,
					ref: (list) => this.place(list, list),
					children: this.renderItems(slot, () => ComboBox.texts.noResults)
				})
			})]
		});
	}
};
export { ComboBox };
