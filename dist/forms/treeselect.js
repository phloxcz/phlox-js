import { effect, untrack } from "../reactive/reactive.js";
import { classes, currentTheme } from "../ui/theme.js";
import { Tree } from "../components/tree.js";
import { TreeView } from "../components/treeview.js";
import { FormControl } from "./controls.js";
import { jsx } from "../jsx-runtime.js";
// src/forms/treeselect.tsx
/**
* Picking from a tree in a form, like the picker of phloxcz/components-tree: every node has a radio button
* (addTreeSelect, one id or null) or a checkbox (addTreeMultiSelect, a list of ids). The tree is shown inline.
*/
/** One node (K | null) or several (K[]). Picked nodes deep in a lazy tree are shown with the `path` option. */
var TreeSelect = class extends FormControl {
	options;
	multiple;
	tree;
	constructor(label = "", options = {}, multiple = false) {
		super(label);
		this.options = options;
		this.multiple = multiple;
		this.tree = new Tree({
			...options,
			pick: multiple ? "multiple" : "single"
		});
	}
	getValue() {
		const ids = this.tree.checked();
		return this.multiple ? ids : ids[0] ?? null;
	}
	setValue(value) {
		const ids = value === null || value === void 0 ? [] : Array.isArray(value) ? [...value] : [value];
		this.tree.checked.set(ids);
		for (const id of ids) this.tree.reveal(id).catch(() => {});
	}
	isFilled() {
		return this.tree.checked().length > 0;
	}
	render(attributes) {
		const { id, name, ref, onBlur, required: _required, disabled: _disabled, ...common } = this.attrs();
		const theme = currentTheme();
		let wrapper;
		effect(() => this.tree.locked.set(this.disabled() ? "disabled" : this.readOnly() ? "readonly" : false));
		let first = true;
		effect(() => {
			this.tree.checked();
			if (first) first = false;
			else untrack(() => this.changed());
		});
		return /* @__PURE__ */ jsx("div", {
			class: () => classes("phlox-treeselect", theme.class("treeselect"), this.hasErrors() && theme.class("invalid"), attributes.class),
			ref: (element) => {
				wrapper = element;
			},
			onFocusout: (event) => {
				if (wrapper.contains(event.relatedTarget)) return;
				onBlur(event);
			},
			children: /* @__PURE__ */ jsx(TreeView, {
				tree: this.tree,
				lines: this.options.lines ?? false,
				name,
				"aria-label": this.label.replace(/:\s*$/, ""),
				attributes: {
					...common,
					id,
					ref
				}
			})
		});
	}
};
export { TreeSelect };
