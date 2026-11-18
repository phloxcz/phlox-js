import { If } from "../ui/flow.js";
import { untrack } from "../reactive/reactive.js";
import { classes, currentTheme } from "../ui/theme.js";
import { ListControl, itemContent } from "./listbox.js";
import { texts } from "../ui/texts.js";
import { jsx } from "../jsx-runtime.js";
// src/forms/dropdownlist.tsx
/**
* DropDownList: a select with a search field, taken over from phloxcz/forms-dropdownlist.
* The same HTML classes, keyboard and look, so a list rendered by the server and one in the SPA match.
* Instead of a URL it gets its items, or a function that searches them, typically an RPC call.
*/
var DropDownList = class DropDownList extends ListControl {
	/** Texts of the list. Replace them for the language of the application: DropDownList.texts.noResults = '...'. */
	static texts = texts("dropdownlist", {
		noResults: "No results",
		filterPlaceholder: "Search…"
	});
	constructor(label = "", options = {}) {
		super(label, options, "dropdownlist");
	}
	open() {
		if (untrack(this.opened) || !this.changeable()) return;
		this.query.set("");
		this.active.set(-1);
		this.edited = true;
		this.opened.set(true);
		this.load("");
	}
	/** After a pick the focus returns to the button, so the user can go on by Tab. */
	pick(value, label) {
		super.pick(value, label);
		this.element?.focus();
	}
	onFilterKey(event) {
		if (this.moveActive(event)) return;
		const item = this.activeItem();
		switch (event.key) {
			case "Enter":
				event.preventDefault();
				if (item) this.pick(...item);
				break;
			case "Tab":
				if (item) this.pick(...item);
				this.close();
				break;
			case "Escape":
				event.preventDefault();
				event.stopPropagation();
				this.close();
				this.element?.focus();
		}
	}
	render(attributes) {
		const theme = currentTheme();
		const slot = (name) => theme.class(`dropdownlist.${name}`);
		const { id, ref, onBlur, required: _required, ...common } = this.attrs();
		let wrapper;
		this.cleanUpSearch();
		return /* @__PURE__ */ jsx("div", {
			class: classes(slot("wrapper"), attributes.class),
			ref: (element) => {
				wrapper = element;
			},
			onFocusout: (event) => {
				if (wrapper.contains(event.relatedTarget)) return;
				this.close();
				onBlur(event);
			},
			children: [/* @__PURE__ */ jsx("button", {
				type: "button",
				...common,
				id,
				ref,
				class: this.classFor({}, "dropdownlist.trigger"),
				role: "combobox",
				"aria-haspopup": "listbox",
				"aria-expanded": () => String(this.opened()),
				"aria-controls": this.listId,
				"aria-required": this.isRequired() ? "true" : null,
				onClick: () => untrack(this.opened) ? this.close() : this.open(),
				onKeydown: (event) => {
					if (event.key === "Enter") event.preventDefault();
					if (event.key === "ArrowDown") {
						event.preventDefault();
						this.open();
					}
					if (event.key === "Escape" && untrack(this.opened)) {
						event.preventDefault();
						event.stopPropagation();
						this.close();
					}
				},
				children: [/* @__PURE__ */ jsx("span", {
					class: () => classes("dropdownlist-trigger-text", !this.selectedLabel() && "dropdownlist-trigger-placeholder"),
					children: () => {
						const value = this.selected();
						return value === null ? this.placeholder : itemContent(value, this.selectedLabel(), this.options, this.objects);
					}
				}), /* @__PURE__ */ jsx("span", {
					class: "dropdownlist-trigger-arrow",
					"aria-hidden": "true"
				})]
			}), /* @__PURE__ */ jsx(If, {
				when: this.opened,
				children: /* @__PURE__ */ jsx("div", {
					class: slot("dropdown"),
					"data-dropdownlist-panel": true,
					ref: (panel) => this.place(panel, panel.querySelector(".dropdownlist-list")),
					children: [/* @__PURE__ */ jsx("div", {
						class: slot("filterRow"),
						children: /* @__PURE__ */ jsx("input", {
							type: "text",
							class: slot("filterInput"),
							autocomplete: "off",
							placeholder: DropDownList.texts.filterPlaceholder,
							"aria-label": DropDownList.texts.filterPlaceholder,
							"aria-controls": this.listId,
							"aria-activedescendant": () => this.active() >= 0 ? `${this.listId}-${this.active()}` : null,
							value: this.query,
							ref: (input) => queueMicrotask(() => input.focus()),
							onInput: (event) => this.searchFor(event.currentTarget.value),
							onKeydown: (event) => this.onFilterKey(event)
						})
					}), /* @__PURE__ */ jsx("ul", {
						role: "listbox",
						id: this.listId,
						class: "dropdownlist-list",
						children: this.renderItems(slot, () => DropDownList.texts.noResults)
					})]
				})
			})]
		});
	}
};
export { DropDownList };
