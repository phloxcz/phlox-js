import { If } from "../ui/flow.js";
import { computed, effect, onCleanup, state, untrack } from "../reactive/reactive.js";
import { classes, currentTheme } from "../ui/theme.js";
import { Tree } from "../components/tree.js";
import { TreeView } from "../components/treeview.js";
import { FormControl } from "./controls.js";
import { placePanel } from "./listbox.js";
import { texts } from "../ui/texts.js";
import { jsx } from "../jsx-runtime.js";
// src/forms/dropdowntree.tsx
/**
* One node of a tree in a drop-down, like a DropDownList whose items are a tree. Closed it shows the way
* from the top to the picked node, "Domácnost › Kuchyně › Nože"; open it shows the tree in a panel.
*/
var lastId = 0;
var DropDownTreeSelect = class DropDownTreeSelect extends FormControl {
	options;
	static texts = texts("dropdowntree", { clear: "Clear" });
	tree;
	/** The picked id, the value of the control. */
	picked = state(null);
	opened = state(false);
	/** True while the way to a node set from code is being loaded. */
	loading = state(false);
	panelId = `phlox-dropdowntree-${++lastId}`;
	/** Nodes from the top down to the picked one, as far as they are loaded. Follows the tree, also a reload. */
	path = computed(() => {
		const id = this.picked();
		if (id === null) return [];
		const search = (items) => {
			for (const item of items) {
				if (item.id === id) return [item];
				const below = search(item.children() ?? []);
				if (below) return [item, ...below];
			}
			return null;
		};
		return search(this.tree.roots()) ?? [];
	});
	constructor(label = "", options = {}) {
		super(label);
		this.options = options;
		this.tree = new Tree({ ...options });
		this.tree.onSelect = (node) => {
			this.picked.set(node.id);
			this.close();
			this.element?.focus();
			this.changed();
		};
	}
	getValue() {
		return this.picked();
	}
	setValue(value) {
		this.picked.set(value ?? null);
		this.tree.selected.set(value ?? null);
	}
	isFilled() {
		return this.picked() !== null;
	}
	open() {
		if (untrack(this.opened) || untrack(this.disabled)) return;
		this.edited = true;
		this.opened.set(true);
	}
	close() {
		this.opened.set(false);
	}
	/** The text of the button: the way to the picked node. */
	text() {
		const path = this.path();
		if (path.length) return path.map((item) => item.node.label).join(this.options.separator ?? " › ");
		const id = this.picked();
		return id === null ? "" : this.loading() ? "…" : String(id);
	}
	render(attributes) {
		const theme = currentTheme();
		const slot = (name) => theme.class(`dropdownlist.${name}`);
		const { id, ref, onBlur, required: _required, ...common } = this.attrs();
		let wrapper;
		effect(() => {
			const value = this.picked();
			if (value === null || this.path().length) return;
			untrack(() => {
				this.loading.set(true);
				this.tree.reveal(value).catch(() => null).finally(() => this.loading.set(false));
			});
		});
		return /* @__PURE__ */ jsx("div", {
			class: classes(slot("wrapper"), "phlox-dropdowntree", attributes.class),
			ref: (element) => {
				wrapper = element;
			},
			onFocusout: (event) => {
				if (wrapper.contains(event.relatedTarget)) return;
				this.close();
				onBlur(event);
			},
			children: [
				/* @__PURE__ */ jsx("button", {
					type: "button",
					...common,
					id,
					ref,
					class: this.classFor({}, "dropdownlist.trigger"),
					role: "combobox",
					"aria-haspopup": "tree",
					"aria-expanded": () => String(this.opened()),
					"aria-controls": this.panelId,
					"aria-required": this.isRequired() ? "true" : null,
					title: () => this.text() || null,
					onClick: () => untrack(this.opened) ? this.close() : this.open(),
					onKeydown: (event) => {
						if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							this.open();
						} else if (event.key === "Escape" && untrack(this.opened)) {
							event.preventDefault();
							event.stopPropagation();
							this.close();
						} else if ((event.key === "Delete" || event.key === "Backspace") && !this.isRequired()) {
							event.preventDefault();
							this.clear();
						}
					},
					children: [/* @__PURE__ */ jsx("span", {
						class: () => classes("dropdownlist-trigger-text", !this.text() && "dropdownlist-trigger-placeholder"),
						children: () => this.text() || this.options.placeholder || ""
					}), /* @__PURE__ */ jsx("span", {
						class: "dropdownlist-trigger-arrow",
						"aria-hidden": "true"
					})]
				}),
				/* @__PURE__ */ jsx(If, {
					when: () => !this.isRequired() && this.picked() !== null && !this.disabled(),
					children: /* @__PURE__ */ jsx("button", {
						type: "button",
						class: "phlox-dropdowntree-clear",
						"aria-label": DropDownTreeSelect.texts.clear,
						title: DropDownTreeSelect.texts.clear,
						tabIndex: -1,
						onClick: () => {
							this.clear();
							this.element?.focus();
						},
						children: "×"
					})
				}),
				/* @__PURE__ */ jsx(If, {
					when: this.opened,
					children: /* @__PURE__ */ jsx("div", {
						class: classes(slot("dropdown"), "phlox-dropdowntree-panel"),
						id: this.panelId,
						"data-dropdownlist-panel": true,
						ref: (panel) => {
							placePanel(() => this.element, panel, panel.querySelector(".phlox-tree"));
							const value = untrack(this.picked);
							(value === null ? this.tree.load() : this.tree.reveal(value)).catch(() => null).then(() => {
								if (untrack(this.opened)) panel.querySelector("[role=tree]")?.focus();
							});
							const onKey = (event) => {
								if (event.key !== "Escape") return;
								event.preventDefault();
								event.stopPropagation();
								this.close();
								this.element?.focus();
							};
							panel.addEventListener("keydown", onKey);
							onCleanup(() => panel.removeEventListener("keydown", onKey));
						},
						children: /* @__PURE__ */ jsx(TreeView, {
							tree: this.tree,
							lines: this.options.lines ?? false,
							"aria-label": this.label.replace(/:\s*$/, "")
						})
					})
				})
			]
		});
	}
	clear() {
		this.setValue(null);
		this.changed();
	}
};
export { DropDownTreeSelect };
