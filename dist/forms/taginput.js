import { For, If } from "../ui/flow.js";
import { computed, onCleanup, state, untrack } from "../reactive/reactive.js";
import { classes, currentTheme } from "../ui/theme.js";
import { FormControl } from "./controls.js";
import { foldText, highlight, itemContent, itemPairs, labelOf, placePanel } from "./listbox.js";
import { texts } from "../ui/texts.js";
import { jsx } from "../jsx-runtime.js";
// src/forms/taginput.tsx
/**
* TagInput: several values as tags, taken over from phloxcz/forms-taginput.
* Tags are picked from suggestions shown while typing, or with `allowNew` made of the typed text.
* Comma and Enter add a tag, Backspace in an empty field removes the last one.
*/
/** How long typing has to pause before `search` is called. */
var DEBOUNCE_MS = 250;
var lastTagInput = 0;
var TagInput = class TagInput extends FormControl {
	options;
	/** Texts of the control. Replace them for the language of the application. */
	static texts = texts("taginput", {
		createNew: "Create: ",
		remove: "Remove"
	});
	tags = state([]);
	text = state("");
	/** Suggestions for the typed text, without tags already added. The last one may be a new tag. */
	suggestions = state([]);
	active = state(-1);
	focused = state(false);
	opened = computed(() => this.suggestions().length > 0 && this.text().trim() !== "" && !this.full());
	placeholder;
	all = [];
	/** Item objects by their values, see ItemOptions. */
	objects = /* @__PURE__ */ new Map();
	request = 0;
	timer;
	listId = `taginput${++lastTagInput}`;
	/** Leaving the field validates, but does not turn the typed text into a tag. */
	leaving = false;
	constructor(label = "", options = {}) {
		super(label);
		this.options = options;
		this.placeholder = options.placeholder ?? "";
		if (options.items) this.setItems(options.items);
	}
	setItems(items) {
		this.all = itemPairs(items, this.options, this.objects);
		return this;
	}
	getValue() {
		return this.tags().map((tag) => tag.value);
	}
	/** Values picked from the suggestions and texts of new tags apart, like getSplitValue() in PHP. */
	getSplitValue() {
		const tags = this.tags();
		return {
			picked: tags.filter((tag) => !tag.isNew).map((tag) => tag.value),
			created: tags.filter((tag) => tag.isNew).map((tag) => String(tag.value))
		};
	}
	/**
	* Sets the tags. Labels (or item objects) can be given, e.g. when the data from the server have them,
	* otherwise they come from the items, or from the `label` option.
	*/
	setValue(values, labels) {
		const tags = (values ?? []).map((value, index) => {
			const given = labels?.[index];
			return {
				value,
				label: (given !== void 0 ? labelOf(value, given, this.options, this.objects) : this.all.find(([item]) => Object.is(item, value))?.[1]) ?? String(value),
				isNew: false
			};
		});
		this.tags.set(tags);
		for (const tag of tags) {
			if (labels?.[tags.indexOf(tag)] !== void 0 || this.all.some(([item]) => Object.is(item, tag.value))) continue;
			Promise.resolve(this.options.label?.(tag.value) ?? null).then((label) => {
				if (label === null) return;
				const text = labelOf(tag.value, label, this.options, this.objects);
				this.tags.update((list) => list.map((other) => other === tag ? {
					...tag,
					label: text
				} : other));
			});
		}
	}
	isFilled() {
		return this.tags().length > 0;
	}
	/** Whether the limit of tags is reached. */
	full() {
		const max = this.options.maxTags ?? 0;
		return max > 0 && this.tags().length >= max;
	}
	/** Adds a tag unless it is there already (texts regardless of case) or the limit is reached. */
	add(value, label, isNew = false) {
		if (this.has(value) || untrack(() => this.full())) return false;
		this.tags.update((list) => [...list, {
			value,
			label,
			isNew
		}]);
		this.text.set("");
		this.suggestions.set([]);
		this.changed();
		return true;
	}
	remove(tag) {
		this.tags.update((list) => list.filter((other) => other !== tag));
		this.changed();
	}
	/**
	* Turns typed text into a tag: a suggestion with exactly this label, or a new tag with allowNew.
	* Returns whether a tag was added.
	*/
	commitText(text) {
		const typed = text.trim();
		if (!typed) return false;
		const exact = [...this.all, ...untrack(this.suggestions).filter((tag) => !tag.isNew).map((tag) => [tag.value, tag.label])].find(([, label]) => foldText(label) === foldText(typed));
		if (exact) return this.add(exact[0], exact[1]);
		if (this.options.allowNew) return this.add(typed, typed, true);
		return false;
	}
	/**
	* Text left in the field becomes a tag before the rules are checked, as it would after Enter.
	* Not when the user only leaves the field: a new tag would make the form taller, and a click on a button
	* below it, e.g. Save, would end somewhere else.
	*/
	validate() {
		if (!this.leaving && this.commitText(untrack(this.text))) this.text.set("");
		return super.validate();
	}
	has(value) {
		const folded = typeof value === "string" ? foldText(value) : null;
		return untrack(this.tags).some((tag) => Object.is(tag.value, value) || folded !== null && typeof tag.value === "string" && foldText(tag.value) === folded);
	}
	/** Suggestions for the text: matching items not yet added, then a new tag when allowed and not an exact item. */
	async suggest(text) {
		const query = text.trim();
		const request = ++this.request;
		if (!query) {
			this.suggestions.set([]);
			return;
		}
		let found;
		if (this.options.search) found = itemPairs(await this.options.search(query), this.options, this.objects);
		else {
			const folded = foldText(query);
			found = this.all.filter(([, label]) => foldText(label).includes(folded));
		}
		if (request !== this.request) return;
		const suggestions = found.filter(([value]) => !this.has(value)).map(([value, label]) => ({
			value,
			label,
			isNew: false
		}));
		const exact = found.some(([, label]) => foldText(label) === foldText(query));
		if (this.options.allowNew && !exact && !this.has(query)) suggestions.push({
			value: query,
			label: query,
			isNew: true
		});
		this.suggestions.set(suggestions);
		this.active.set(-1);
	}
	onInput(value) {
		const comma = value.indexOf(",");
		if (comma >= 0) {
			const before = value.slice(0, comma);
			const suggestion = untrack(this.opened) ? untrack(this.suggestions)[Math.max(untrack(this.active), 0)] : void 0;
			if (suggestion) this.add(suggestion.value, suggestion.label, suggestion.isNew);
			else if (!this.commitText(before)) this.text.set(before.trim());
			return;
		}
		this.text.set(value);
		clearTimeout(this.timer);
		if (this.options.search && value.trim()) this.timer = setTimeout(() => void this.suggest(value), DEBOUNCE_MS);
		else this.suggest(value);
	}
	onKey(event) {
		const opened = untrack(this.opened);
		const suggestions = untrack(this.suggestions);
		const active = untrack(this.active);
		switch (event.key) {
			case "Enter":
				event.preventDefault();
				if (opened) {
					const suggestion = suggestions[Math.max(active, 0)];
					this.add(suggestion.value, suggestion.label, suggestion.isNew);
				} else this.commitText(untrack(this.text));
				break;
			case "Backspace":
				if (untrack(this.text) === "" && untrack(this.tags).length > 0) {
					event.preventDefault();
					this.remove(untrack(this.tags).at(-1));
				}
				break;
			case "ArrowDown":
				event.preventDefault();
				if (opened) this.active.set((active + 1) % suggestions.length);
				else this.suggest(untrack(this.text));
				break;
			case "ArrowUp":
				event.preventDefault();
				if (opened) this.active.set((active - 1 + suggestions.length) % suggestions.length);
				break;
			case "Tab":
				if (opened && active >= 0) {
					event.preventDefault();
					const suggestion = suggestions[active];
					this.add(suggestion.value, suggestion.label, suggestion.isNew);
				}
				break;
			case "Escape": if (opened) {
				event.preventDefault();
				event.stopPropagation();
				this.suggestions.set([]);
			}
		}
	}
	render(attributes) {
		const theme = currentTheme();
		const slot = (name) => theme.class(`taginput.${name}`);
		const { id, ref, onBlur, required: _required, ...common } = this.attrs();
		let wrapper;
		let container;
		let input;
		onCleanup(() => clearTimeout(this.timer));
		const removeText = slot("tagRemove").includes("btn-close") ? null : "×";
		return /* @__PURE__ */ jsx("div", {
			class: () => classes(slot("wrapper"), this.focused() && slot("focused"), attributes.class),
			"data-phlox-taginput": true,
			ref: (element) => {
				wrapper = element;
			},
			onFocusout: (event) => {
				if (wrapper.contains(event.relatedTarget)) return;
				this.focused.set(false);
				this.suggestions.set([]);
				this.leaving = true;
				onBlur(event);
				this.leaving = false;
			},
			children: [/* @__PURE__ */ jsx("div", {
				class: () => classes(slot("container"), this.focused() && slot("focused"), this.hasErrors() && slot("invalid")),
				role: "group",
				"aria-label": this.label.replace(/:\s*$/, "") || null,
				"data-phlox-taginput-container": true,
				ref: (element) => {
					container = element;
				},
				onClick: (event) => {
					if (!event.target.closest("[data-phlox-taginput-remove]")) input.focus();
				},
				children: [/* @__PURE__ */ jsx(For, {
					each: this.tags,
					children: (tag) => /* @__PURE__ */ jsx("span", {
						class: classes(slot("tag"), tag.isNew ? slot("tagNew") : slot("tagExisting")),
						"data-phlox-taginput-tag": true,
						"data-value": String(tag.value),
						"data-is-new": tag.isNew ? "1" : "0",
						children: [/* @__PURE__ */ jsx("span", {
							"data-phlox-tag-label": true,
							children: itemContent(tag.value, tag.label, this.options, this.objects)
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							class: slot("tagRemove"),
							tabIndex: -1,
							"data-phlox-taginput-remove": true,
							"aria-label": `${TagInput.texts.remove} ${tag.label}`,
							disabled: this.disabled,
							onClick: (event) => {
								event.stopPropagation();
								this.remove(tag);
								input.focus();
							},
							children: removeText
						})]
					})
				}), /* @__PURE__ */ jsx("input", {
					type: "text",
					...attributes,
					...common,
					id,
					ref: (element) => {
						input = element;
						ref(element);
					},
					class: slot("input"),
					autocomplete: "off",
					spellcheck: false,
					role: "combobox",
					"aria-autocomplete": "list",
					"aria-haspopup": "listbox",
					"aria-expanded": () => String(this.opened()),
					"aria-controls": this.listId,
					"aria-activedescendant": () => this.opened() && this.active() >= 0 ? `${this.listId}-${this.active()}` : null,
					placeholder: () => this.tags().length ? null : this.placeholder || null,
					value: this.text,
					onFocus: () => this.focused.set(true),
					onInput: (event) => {
						this.onInput(event.currentTarget.value);
						if (event.currentTarget.value !== untrack(this.text)) event.currentTarget.value = untrack(this.text);
					},
					onKeydown: (event) => this.onKey(event)
				})]
			}), /* @__PURE__ */ jsx(If, {
				when: this.opened,
				children: /* @__PURE__ */ jsx("div", {
					role: "listbox",
					id: this.listId,
					class: slot("dropdown"),
					"data-phlox-taginput-dropdown": true,
					ref: (panel) => placePanel(() => container, panel, panel),
					children: /* @__PURE__ */ jsx(For, {
						each: this.suggestions,
						children: (suggestion, index) => /* @__PURE__ */ jsx("div", {
							role: "option",
							id: () => `${this.listId}-${index()}`,
							"aria-selected": () => String(this.active() === index()),
							class: () => classes(suggestion.isNew ? slot("optionNew") : slot("option"), this.active() === index() && slot("optionActive")),
							onMousedown: (event) => {
								event.preventDefault();
								this.add(suggestion.value, suggestion.label, suggestion.isNew);
							},
							children: suggestion.isNew ? [/* @__PURE__ */ jsx("strong", { children: TagInput.texts.createNew }), `"${suggestion.label}"`] : itemContent(suggestion.value, () => highlight(suggestion.label, this.text().trim(), ""), this.options, this.objects)
						})
					})
				})
			})]
		});
	}
};
export { TagInput };
