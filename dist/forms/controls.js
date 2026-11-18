import { For } from "../ui/flow.js";
import { state, untrack } from "../reactive/reactive.js";
import { reveal } from "../ui/reveal.js";
import { classes, currentTheme } from "../ui/theme.js";
import { Rules } from "./rules.js";
import { jsx } from "../jsx-runtime.js";
// src/forms/controls.tsx
/** Form controls, like Nette\Forms\Controls. Each holds its value in state, so templates follow it. */
/** Items as pairs of value and label. */
function toPairs(items) {
	if (Array.isArray(items)) return items.map((item) => Array.isArray(item) ? [item[0], String(item[1])] : [item, String(item)]);
	return Object.entries(items).map(([key, label]) => [/^-?\d+$/.test(key) ? Number(key) : key, label]);
}
var FormControl = class {
	label;
	/** Set by the form when the control is added. */
	form;
	/** The form or a nested container the control is in. */
	container;
	name = "";
	errors = state([]);
	disabled = state(false);
	/** Shown as usual but the user cannot change it; unlike disabled it stays in the values, see setReadOnly(). */
	readOnly = state(false);
	rules;
	/** Left out of getValues(). Buttons are omitted, other controls can be by setOmitted(). */
	omitted = false;
	/** The element the user works with, for focus after a failed validation. */
	element = null;
	/** The label is part of the input itself, e.g. a checkbox. */
	labelInInput = false;
	/** The user has left the field after changing it: from now on the rules are checked while typing. */
	touched = false;
	/** The user has changed the value, or opened its list. Leaving a field nobody has worked with checks nothing. */
	edited = false;
	/**
	* The value as a state, like a binding in MVVM. Given to a template without calling it, the text follows
	* typing: <h2>{control.value}</h2>. control.value() reads it, control.value.set(x) writes it to the field,
	* the same as getValue() and setValue().
	*/
	value = Object.assign(() => this.getValue(), {
		set: (value) => this.setValue(value),
		update: (change) => this.setValue(change(untrack(() => this.getValue())))
	});
	constructor(label = "") {
		this.label = label;
		this.rules = new Rules(this);
	}
	get htmlId() {
		return `${this.container.idPrefix}-${this.name}`;
	}
	/** The name attribute, like customer[city] in Nette for a control in a container. */
	get htmlName() {
		return this.container.htmlName(this.name);
	}
	setRequired(message = true) {
		this.rules.setRequired(message);
		return this;
	}
	isRequired() {
		return this.rules.isRequired();
	}
	addRule(validator, message = null, arg) {
		this.rules.addRule(validator, message, arg);
		return this;
	}
	addCondition(validator, arg) {
		return this.rules.addCondition(validator, arg);
	}
	addConditionOn(control, validator, arg) {
		return this.rules.addConditionOn(control, validator, arg);
	}
	setDisabled(disabled = true) {
		this.disabled.set(disabled);
		return this;
	}
	/**
	* Read-only, like readonly in HTML: the value is shown as usual (not greyed out), the user cannot change it,
	* and unlike setDisabled() it stays in the values of the form and is checked by the rules.
	*/
	setReadOnly(readOnly = true) {
		this.readOnly.set(readOnly);
		return this;
	}
	setOmitted(omitted = true) {
		this.omitted = omitted;
		return this;
	}
	addError(message) {
		this.errors.update((errors) => [...errors, message]);
	}
	hasErrors() {
		return this.errors().length > 0;
	}
	cleanErrors() {
		this.errors.set([]);
	}
	/** Puts the focus into the control, e.g. after a failed validation or from a button "Write a comment". */
	focus() {
		reveal(this.element);
		this.element?.focus();
	}
	/** As if the user had not worked with the control yet: no errors, leaving it checks nothing. Used by reset(). */
	pristine() {
		this.touched = false;
		this.edited = false;
		this.errors.set([]);
	}
	/** Checks the rules. A disabled control is not checked, as in Nette. */
	validate() {
		const error = this.disabled() ? null : this.rules.validate();
		this.errors.set(error ? [error] : []);
		return !error;
	}
	/** Attributes for an own element, like n:name in Latte: <input {...control.attrs()} class="x" />. */
	attrs() {
		return {
			id: this.htmlId,
			name: this.htmlName,
			required: this.isRequired(),
			disabled: this.disabled,
			"aria-readonly": () => this.readOnly() ? "true" : null,
			"aria-invalid": () => this.hasErrors() ? "true" : null,
			"aria-describedby": () => this.hasErrors() ? `${this.htmlId}-error` : null,
			ref: (element) => {
				this.element = element;
			},
			onBlur: (event) => {
				if (!this.edited && !this.hasErrors()) return;
				this.touched = true;
				if (event?.relatedTarget instanceof HTMLButtonElement) return;
				this.validate();
			}
		};
	}
	/**
	* Classes of a rendered element: those of the theme slot, the `invalid` class while there is an error,
	* and the class passed to <Input>. Call it while rendering, the theme is the one of the running application.
	*/
	classFor(attributes, slot) {
		const theme = currentTheme();
		const own = attributes.class;
		return () => classes(theme.class(slot), this.hasErrors() && theme.class("invalid"), typeof own === "function" ? own() : own);
	}
	/** After a change: once there is an error or the user has left the field, the rules are checked live. */
	changed() {
		this.edited = true;
		if (this.touched || this.hasErrors()) this.validate();
	}
};
/** Text field. With addInteger() and addFloat() its value is a number, with addDate() a text YYYY-MM-DD. */
var TextInput = class extends FormControl {
	kind;
	raw = state("");
	nullable = false;
	htmlType = "text";
	constructor(label = "", kind = "text") {
		super(label);
		this.kind = kind;
		if (kind === "integer" || kind === "float") this.htmlType = "number";
		if (kind === "date") this.htmlType = "date";
	}
	/** An empty field gives null instead of ''. Number and date fields are nullable always. */
	setNullable(nullable = true) {
		this.nullable = nullable;
		return this;
	}
	setHtmlType(type) {
		this.htmlType = type;
		return this;
	}
	getRawValue() {
		return this.raw();
	}
	getValue() {
		const raw = this.raw().trim();
		if (this.kind === "text") return raw === "" && this.nullable ? null : this.raw();
		if (raw === "") return null;
		if (this.kind === "date") return raw;
		const number = Number(raw.replace(",", "."));
		return Number.isNaN(number) ? null : number;
	}
	setValue(value) {
		this.raw.set(value === null || value === void 0 ? "" : String(value));
	}
	isFilled() {
		return this.raw().trim() !== "";
	}
	attrs() {
		return {
			...super.attrs(),
			readOnly: this.readOnly,
			value: this.raw,
			onInput: (event) => {
				this.raw.set(event.currentTarget.value);
				this.changed();
			}
		};
	}
	render(attributes) {
		return /* @__PURE__ */ jsx("input", {
			type: this.htmlType,
			...attributes,
			...this.attrs(),
			class: this.classFor(attributes, "input")
		});
	}
};
var TextArea = class extends TextInput {
	render(attributes) {
		return /* @__PURE__ */ jsx("textarea", {
			...attributes,
			...this.attrs(),
			class: this.classFor(attributes, "textarea")
		});
	}
};
var Checkbox = class extends FormControl {
	checked = state(false);
	labelInInput = true;
	getValue() {
		return this.checked();
	}
	setValue(value) {
		this.checked.set(Boolean(value));
	}
	isFilled() {
		return this.checked();
	}
	attrs() {
		return {
			...super.attrs(),
			checked: this.checked,
			onClick: (event) => blockWhenReadOnly(this, event),
			onChange: (event) => {
				this.checked.set(event.currentTarget.checked);
				this.changed();
			}
		};
	}
	/** The checkbox inside its label, as in Nette. */
	render(attributes) {
		return /* @__PURE__ */ jsx("label", {
			class: currentTheme().class("checkbox"),
			children: [
				/* @__PURE__ */ jsx("input", {
					type: "checkbox",
					...attributes,
					...this.attrs(),
					class: this.classFor(attributes, "checkboxInput")
				}),
				" ",
				this.label
			]
		});
	}
};
/** A read-only checkbox or radio button keeps its state: the click that would change it is cancelled. */
function blockWhenReadOnly(control, event) {
	if (untrack(control.readOnly)) event.preventDefault();
}
/** A read-only select does not open and does not change by the keyboard; Tab still moves on. */
function selectReadOnly(control) {
	return {
		onMousedown: (event) => blockWhenReadOnly(control, event),
		onKeydown: (event) => {
			if (event.key !== "Tab") blockWhenReadOnly(control, event);
		}
	};
}
/** Common part of controls with choices. */
var ChoiceControl = class extends FormControl {
	items = state([]);
	/** Items that are shown but cannot be chosen, see setDisabled(). */
	disabledItems = state([]);
	constructor(label = "", items = []) {
		super(label);
		this.setItems(items);
	}
	/** Choices can be set later, e.g. when they come from the server. */
	setItems(items) {
		this.items.set(toPairs(items));
		return this;
	}
	/** true or false for the whole control, or the values of items that cannot be chosen: setDisabled(['b']), as in Nette. */
	setDisabled(disabled = true) {
		if (!Array.isArray(disabled)) return super.setDisabled(disabled);
		this.disabledItems.set([...disabled]);
		return this;
	}
	isItemDisabled(value) {
		return this.disabledItems().some((item) => Object.is(item, value));
	}
	indexOf(value) {
		return this.items().findIndex(([item]) => Object.is(item, value));
	}
};
var SelectBox = class extends ChoiceControl {
	selected = state(null);
	prompt = null;
	/** The first option without a value, like setPrompt() in Nette. */
	setPrompt(prompt) {
		this.prompt = prompt;
		return this;
	}
	getValue() {
		return this.selected();
	}
	setValue(value) {
		this.selected.set(value);
	}
	isFilled() {
		return this.selected() !== null;
	}
	render(attributes) {
		return /* @__PURE__ */ jsx("select", {
			...attributes,
			...this.attrs(),
			class: this.classFor(attributes, "select"),
			...selectReadOnly(this),
			value: () => {
				const index = this.selected() === null ? -1 : this.indexOf(this.selected());
				return index < 0 ? "" : String(index);
			},
			onChange: (event) => {
				const index = event.currentTarget.value;
				this.selected.set(index === "" ? null : this.items()[Number(index)][0]);
				this.changed();
			},
			children: [this.prompt === null ? null : /* @__PURE__ */ jsx("option", {
				value: "",
				children: this.prompt
			}), /* @__PURE__ */ jsx(For, {
				each: this.items,
				children: ([value, label], index) => /* @__PURE__ */ jsx("option", {
					value: () => String(index()),
					disabled: () => this.isItemDisabled(value),
					children: label
				})
			})]
		});
	}
};
var MultiSelectBox = class extends ChoiceControl {
	selected = state([]);
	getValue() {
		return this.selected();
	}
	setValue(value) {
		this.selected.set([...value ?? []]);
	}
	isFilled() {
		return this.selected().length > 0;
	}
	render(attributes) {
		return /* @__PURE__ */ jsx("select", {
			multiple: true,
			...attributes,
			...this.attrs(),
			class: this.classFor(attributes, "select"),
			...selectReadOnly(this),
			onChange: (event) => {
				const chosen = [...event.currentTarget.selectedOptions].map((option) => this.items()[Number(option.value)][0]);
				this.selected.set(chosen);
				this.changed();
			},
			children: /* @__PURE__ */ jsx(For, {
				each: this.items,
				children: ([value, label], index) => /* @__PURE__ */ jsx("option", {
					value: () => String(index()),
					selected: () => this.selected().includes(value),
					disabled: () => this.isItemDisabled(value),
					children: label
				})
			})
		});
	}
};
var RadioList = class extends ChoiceControl {
	selected = state(null);
	getValue() {
		return this.selected();
	}
	setValue(value) {
		this.selected.set(value);
	}
	isFilled() {
		return this.selected() !== null;
	}
	render(attributes) {
		const { id, ...common } = this.attrs();
		const theme = currentTheme();
		const inputClass = this.classFor({}, "choiceInput");
		return /* @__PURE__ */ jsx("div", {
			id,
			role: "radiogroup",
			...attributes,
			class: classes(theme.class("radioList"), attributes.class),
			children: /* @__PURE__ */ jsx(For, {
				each: this.items,
				children: ([value, label], index) => /* @__PURE__ */ jsx("label", {
					class: theme.class("choiceItem"),
					children: [
						/* @__PURE__ */ jsx("input", {
							type: "radio",
							...common,
							class: inputClass,
							id: () => `${this.htmlId}-${index()}`,
							checked: () => Object.is(this.selected(), value),
							disabled: () => this.disabled() || this.isItemDisabled(value),
							onClick: (event) => blockWhenReadOnly(this, event),
							onChange: () => {
								this.selected.set(value);
								this.changed();
							}
						}),
						" ",
						label
					]
				})
			})
		});
	}
};
var CheckboxList = class extends ChoiceControl {
	selected = state([]);
	getValue() {
		return this.selected();
	}
	setValue(value) {
		this.selected.set([...value ?? []]);
	}
	isFilled() {
		return this.selected().length > 0;
	}
	render(attributes) {
		const { id, required: _required, ...common } = this.attrs();
		const theme = currentTheme();
		const inputClass = this.classFor({}, "choiceInput");
		return /* @__PURE__ */ jsx("div", {
			id,
			...attributes,
			class: classes(theme.class("checkboxList"), attributes.class),
			children: /* @__PURE__ */ jsx(For, {
				each: this.items,
				children: ([value, label], index) => /* @__PURE__ */ jsx("label", {
					class: theme.class("choiceItem"),
					children: [
						/* @__PURE__ */ jsx("input", {
							type: "checkbox",
							...common,
							class: inputClass,
							id: () => `${this.htmlId}-${index()}`,
							checked: () => this.selected().includes(value),
							disabled: () => this.disabled() || this.isItemDisabled(value),
							onClick: (event) => blockWhenReadOnly(this, event),
							onChange: (event) => {
								const on = event.currentTarget.checked;
								this.selected.set(this.items().map(([item]) => item).filter((item) => Object.is(item, value) ? on : this.selected().includes(item)));
								this.changed();
							}
						}),
						" ",
						label
					]
				})
			})
		});
	}
};
var HiddenField = class extends FormControl {
	raw = state("");
	getValue() {
		return this.raw();
	}
	setValue(value) {
		this.raw.set(value === null || value === void 0 ? "" : String(value));
	}
	isFilled() {
		return this.raw() !== "";
	}
	render(attributes) {
		return /* @__PURE__ */ jsx("input", {
			type: "hidden",
			...attributes,
			id: this.htmlId,
			name: this.htmlName,
			value: this.raw
		});
	}
};
var SubmitButton = class extends FormControl {
	caption;
	/** Controls validated when the form is sent by this button. An empty list validates nothing, e.g. for Cancel. */
	validationScope = null;
	constructor(caption = "") {
		super("");
		this.caption = caption;
		this.omitted = true;
	}
	setValidationScope(controls) {
		this.validationScope = controls;
		return this;
	}
	/** Whether the form is being sent by this button, for the handler of onSuccess. */
	isSubmittedBy() {
		return this.form.submittedBy === this;
	}
	getValue() {}
	setValue() {}
	isFilled() {
		return false;
	}
	/** A class passed to <Input> replaces the one of the theme, e.g. class="btn btn-secondary" for Cancel. */
	render(attributes) {
		return /* @__PURE__ */ jsx("button", {
			type: "submit",
			...attributes,
			class: attributes.class ?? currentTheme().class("button"),
			id: this.htmlId,
			name: this.htmlName,
			disabled: () => this.disabled() || this.form.submitting(),
			onClick: () => {
				this.form.clickedButton = this;
			},
			children: this.caption
		});
	}
};
export { Checkbox, CheckboxList, FormControl, HiddenField, MultiSelectBox, RadioList, SelectBox, SubmitButton, TextArea, TextInput, toPairs };
