import { batch, computed, state, untrack } from "../reactive/reactive.js";
import { FormControl } from "./controls.js";
import { Container } from "./container.js";
import { Multiplier } from "./multiplier.js";
import { messages, validators } from "./rules.js";
// src/forms/form.ts
/**
* Form, like Nette\Forms\Form. V is the type of its values, usually a DTO generated from PHP.
* The controls are added by methods of Container, which a form is, as in Nette.
*/
var lastId = 0;
/** Equal values: primitives, plain objects and arrays by content, anything else (a File) by identity. */
function same(a, b) {
	if (Object.is(a, b)) return true;
	if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((item, i) => same(item, b[i]));
	if (!isPlain(a) || !isPlain(b)) return false;
	const keys = Object.keys(a);
	return keys.length === Object.keys(b).length && keys.every((key) => same(a[key], b[key]));
}
function isPlain(value) {
	return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}
/** A copy of plain objects and arrays, so later changes of the values do not change it. */
function copy(value) {
	if (Array.isArray(value)) return value.map(copy);
	if (isPlain(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
	return value;
}
var Form = class extends Container {
	static Filled = validators.Filled;
	static Required = validators.Filled;
	static Blank = validators.Blank;
	static Equal = validators.Equal;
	static NotEqual = validators.NotEqual;
	static MinLength = validators.MinLength;
	static MaxLength = validators.MaxLength;
	static Length = validators.Length;
	static Email = validators.Email;
	static URL = validators.URL;
	static Pattern = validators.Pattern;
	static Integer = validators.Integer;
	static Numeric = validators.Integer;
	static Float = validators.Float;
	static Min = validators.Min;
	static Max = validators.Max;
	static Range = validators.Range;
	static IsIn = validators.IsIn;
	static MaxFileSize = validators.MaxFileSize;
	static MimeType = validators.MimeType;
	static Image = validators.Image;
	/** Default messages of the rules, keyed by the validator: Form.messages.set(Form.Filled, 'Vyplňte.'). */
	static messages = messages;
	id = `frm${++lastId}`;
	/** Submit buttons of the whole form, also those added to containers. */
	buttons = /* @__PURE__ */ new Map();
	/** Errors of the whole form, not of one control. */
	errors = state([]);
	/** The values the form was filled with or last saved, see isChanged(). */
	saved = state(null);
	/**
	* True when the values differ from the saved ones: those from setDefaults(), after a successful submit,
	* after reset(), or those the form had when it was first rendered. For Component.hasUnsavedChanges().
	*/
	isChanged = computed(() => {
		const saved = this.saved();
		return saved !== null && !same(this.getValues(), saved);
	});
	/** True while onSuccess runs. Submit buttons are disabled meanwhile. */
	submitting = state(false);
	/** Called with the values when the form is sent and valid. An RpcError with invalid fields is shown at the fields. */
	onSuccess = null;
	/** Called when the form is sent but not valid. */
	onError = null;
	submittedBy = null;
	/** The button the user clicked, set by the button. */
	clickedButton = null;
	element = null;
	/** Elements switched by toggle() in rules: id → visible. */
	toggles = computed(() => {
		const result = /* @__PURE__ */ new Map();
		this.collectToggles(result);
		return result;
	});
	get form() {
		return this;
	}
	get idPrefix() {
		return this.id;
	}
	htmlName(name) {
		return name;
	}
	getButton(name) {
		const button = this.buttons.get(name);
		if (!button) throw new Error(`The form has no button '${name}'.`);
		return button;
	}
	/** Fills the controls, typically with data loaded from the server. The same as setValues(). */
	setDefaults(values) {
		batch(() => {
			this.setValues(values);
			this.markSaved();
		});
		return this;
	}
	/** The current values are the saved ones, isChanged() is false. For saving outside onSuccess. */
	markSaved() {
		this.saved.set(copy(untrack(() => this.getValues())));
	}
	/** @internal The first rendering remembers the values unless something has been saved before. */
	markRendered() {
		if (untrack(this.saved) === null) this.markSaved();
	}
	/** Checks the given controls, or the whole form. Returns whether they are valid. */
	validate(controls) {
		this.errors.set([]);
		if (!controls) return this.validateAll();
		let valid = true;
		batch(() => {
			for (const control of controls) valid = control.validate() && valid;
		});
		return valid;
	}
	hasErrors() {
		return this.errors().length > 0 || super.hasErrors();
	}
	addError(message) {
		this.errors.update((errors) => [...errors, message]);
	}
	/**
	* Shows errors of invalid parameters from the server at the controls. Paths such as `input.name`
	* lead to the control `name`, `input.lines.2.quantity` to the quantity in the third row.
	* A path with no control becomes an error of the form. Returns whether the error had such fields.
	*/
	addServerErrors(error, prefix) {
		const source = error;
		const fields = source?.data?.fields ?? source?.fields;
		if (!fields || typeof fields !== "object") return false;
		batch(() => {
			for (const [path, message] of Object.entries(fields)) {
				const segments = (prefix && path.startsWith(`${prefix}.`) ? path.slice(prefix.length + 1) : path).split(".");
				const target = this.resolve(segments) ?? (prefix ? null : this.resolve(segments.slice(1)));
				for (const text of Array.isArray(message) ? message : [message]) if (target instanceof FormControl || target instanceof Multiplier) target.addError(String(text));
				else this.addError(`${path}: ${String(text)}`);
			}
		});
		this.focusFirstError();
		return true;
	}
	/**
	* Validates and calls onSuccess, as when the user sends the form.
	* Returns whether it went through. An error thrown by onSuccess is thrown on,
	* except invalid parameters from the server, which are shown at the controls.
	*/
	async submit(button = null) {
		if (untrack(this.submitting)) return false;
		this.submittedBy = button;
		if (!this.validate(button?.validationScope ?? void 0)) {
			this.focusFirstError();
			this.onError?.(this);
			return false;
		}
		this.submitting.set(true);
		try {
			await this.onSuccess?.(untrack(() => this.getValues()), this);
			this.markSaved();
			return true;
		} catch (error) {
			if (this.addServerErrors(error)) return false;
			throw error;
		} finally {
			this.submitting.set(false);
			this.submittedBy = null;
		}
	}
	/** Empties all controls and errors. */
	reset() {
		batch(() => {
			super.reset();
			this.errors.set([]);
			this.markSaved();
		});
	}
};
export { Form };
