import { texts } from "../ui/texts.js";
// src/forms/rules.ts
/** Value of an argument: another control stands for its value, as in Form::Equal with $form['password']. */
function resolve(arg) {
	return arg && typeof arg === "object" && "getValue" in arg ? arg.getValue() : arg;
}
var list = (arg) => (Array.isArray(arg) ? arg : [arg]).map(resolve);
/** What the user typed, also for a number field whose text is not a number yet. */
function text(control) {
	if ("getRawValue" in control) return control.getRawValue();
	const value = control.getValue();
	return value === null || value === void 0 ? "" : String(value);
}
function length(control) {
	const value = control.getValue();
	return Array.isArray(value) ? value.length : text(control).length;
}
function compare(value, limit) {
	if (typeof value === "number" && typeof limit === "number") return value - limit;
	return String(value) < String(limit) ? -1 : String(value) > String(limit) ? 1 : 0;
}
var inRange = (value, [min, max]) => (min === null || value >= min) && (max === null || value <= max);
function validUrl(value) {
	try {
		const url = new URL(/^[a-z][\w+.-]*:\/\//i.test(value) ? value : `http://${value}`);
		return /^https?:$/.test(url.protocol) && url.hostname.includes(".");
	} catch {
		return false;
	}
}
/** Files of an upload, one or several. */
function files(control) {
	const value = control.getValue();
	return (Array.isArray(value) ? value : [value]).filter((file) => file instanceof File);
}
/** Image formats of Form.Image, the same as in Nette. */
var IMAGE_TYPES = [
	"image/gif",
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/avif"
];
/** Whether a MIME type matches one of the patterns, which may end with a wildcard: image/*. */
var mimeMatches = (type, patterns) => patterns.some((pattern) => pattern.endsWith("/*") ? type.startsWith(pattern.slice(0, -1)) : type === pattern);
var maxFileSize = (file, arg) => file.size <= Number(resolve(arg));
var mimeType = (file, arg) => mimeMatches(file.type, list(arg).map(String));
var image = (file) => IMAGE_TYPES.includes(file.type);
/** The validators, also available as Form.Filled, Form.Email and so on. */
var validators = {
	Filled: ((control) => control.isFilled()),
	Blank: ((control) => !control.isFilled()),
	Equal: ((control, arg) => list(arg).some((value) => Object.is(value, control.getValue()) || String(value) === text(control))),
	NotEqual: ((control, arg) => !list(arg).some((value) => Object.is(value, control.getValue()) || String(value) === text(control))),
	MinLength: ((control, arg) => length(control) >= Number(resolve(arg))),
	MaxLength: ((control, arg) => length(control) <= Number(resolve(arg))),
	Length: ((control, arg) => inRange(length(control), Array.isArray(arg) ? arg : [arg, arg])),
	Email: ((control) => /^[^\s@]+@[^\s@]+\.[^\s@.]+$/.test(text(control))),
	URL: ((control) => validUrl(text(control))),
	Pattern: ((control, arg) => new RegExp(`^(?:${String(arg)})$`, "u").test(text(control))),
	Integer: ((control) => /^-?\d+$/.test(text(control).trim())),
	Float: ((control) => /^-?(\d+([.,]\d*)?|[.,]\d+)$/.test(text(control).trim())),
	Min: ((control, arg) => compare(control.getValue(), resolve(arg)) >= 0),
	Max: ((control, arg) => compare(control.getValue(), resolve(arg)) <= 0),
	Range: ((control, arg) => {
		const [min, max] = arg.map(resolve);
		return (min === null || min === void 0 || compare(control.getValue(), min) >= 0) && (max === null || max === void 0 || compare(control.getValue(), max) <= 0);
	}),
	IsIn: ((control, arg) => list(arg).includes(control.getValue())),
	MaxFileSize: ((control, arg) => files(control).every((file) => maxFileSize(file, arg))),
	MimeType: ((control, arg) => files(control).every((file) => mimeType(file, arg))),
	Image: ((control) => files(control).every(image))
};
/** Checks of one file, so an upload can mark which of its files breaks a rule. */
var fileChecks = /* @__PURE__ */ new Map([
	[validators.MaxFileSize, maxFileSize],
	[validators.MimeType, mimeType],
	[validators.Image, image]
]);
/** These are checked even when the control is empty. All other rules apply only to a filled control, as in Nette. */
var CHECKS_EMPTY = /* @__PURE__ */ new Set([validators.Filled, validators.Blank]);
/** Messages used when addRule() gets none. Replace them for the language of the application. */
var messages = /* @__PURE__ */ new Map([
	[validators.Filled, "This field is required."],
	[validators.Blank, "This field should be blank."],
	[validators.Equal, "Please enter %s."],
	[validators.NotEqual, "This value should not be %s."],
	[validators.MinLength, "Please enter at least %d characters."],
	[validators.MaxLength, "Please enter no more than %d characters."],
	[validators.Length, "Please enter a value between %d and %d characters long."],
	[validators.Email, "Please enter a valid email address."],
	[validators.URL, "Please enter a valid URL."],
	[validators.Pattern, "Please enter a value in the required format."],
	[validators.Integer, "Please enter a valid integer."],
	[validators.Float, "Please enter a valid number."],
	[validators.Min, "Please enter a value greater than or equal to %d."],
	[validators.Max, "Please enter a value less than or equal to %d."],
	[validators.Range, "Please enter a value between %d and %d."],
	[validators.IsIn, "Please submit one of the allowed values."],
	[validators.MaxFileSize, "The size of the uploaded file can be up to %d bytes."],
	[validators.MimeType, "The uploaded file is not in the expected format."],
	[validators.Image, "The uploaded file must be image in format JPEG, GIF, PNG, WebP or AVIF."]
]);
var ruleTexts = {};
for (const [name, validator] of Object.entries(validators)) {
	if (!messages.has(validator)) continue;
	Object.defineProperty(ruleTexts, name, {
		enumerable: true,
		get: () => messages.get(validator),
		set: (text) => messages.set(validator, text)
	});
}
texts("rules", ruleTexts);
/** %label, %name and %value, then %d and %s in order of the arguments. */
function format(message, control, arg) {
	const args = arg === void 0 ? [] : list(arg);
	let next = 0;
	return message.replaceAll("%label", control.label.replace(/:\s*$/, "")).replaceAll("%name", control.name).replaceAll("%value", text(control)).replace(/%[ds]/g, (placeholder) => next < args.length ? String(args[next++]) : placeholder);
}
var Rules = class Rules {
	control;
	parent;
	items = [];
	toggles = /* @__PURE__ */ new Map();
	/** The condition this set of rules belongs to, for elseCondition(). */
	owner = null;
	constructor(control, parent = null) {
		this.control = control;
		this.parent = parent;
	}
	addRule(validator, message = null, arg) {
		this.items.push({
			validator,
			arg,
			message
		});
		return this;
	}
	/** Rules added after this apply only when the condition holds, until endCondition(). */
	addCondition(validator, arg) {
		return this.addConditionOn(this.control, validator, arg);
	}
	/** The same as addCondition(), but the condition checks another control. */
	addConditionOn(control, validator, arg) {
		const branch = new Rules(this.control, this);
		const condition = {
			control,
			validator,
			arg,
			branch,
			otherwise: null
		};
		branch.owner = condition;
		this.items.push(condition);
		return branch;
	}
	/** Rules for when the condition does not hold. */
	elseCondition() {
		if (!this.owner || !this.parent) throw new Error("elseCondition() must follow addCondition().");
		this.owner.otherwise ??= new Rules(this.control, this.parent);
		return this.owner.otherwise;
	}
	endCondition() {
		if (!this.parent) throw new Error("endCondition() must follow addCondition().");
		return this.parent;
	}
	/** Shows the element with the id while the condition holds, hides it otherwise. With false the other way round. */
	toggle(id, show = true) {
		this.toggles.set(id, show);
		return this;
	}
	/** Makes the control required, or not. In a condition it is required only while the condition holds. */
	setRequired(message = true) {
		this.items = this.items.filter((item) => !("message" in item) || item.validator !== validators.Filled);
		if (message !== false) this.items.unshift({
			validator: validators.Filled,
			arg: void 0,
			message: message === true ? null : message
		});
		return this;
	}
	isRequired() {
		return this.items.some((item) => "message" in item && item.validator === validators.Filled);
	}
	/** Rules that apply now: the own ones and those of conditions that hold. */
	active() {
		return this.items.flatMap((item) => {
			if (!("branch" in item)) return [item];
			return (item.validator(item.control, item.arg) ? item.branch : item.otherwise)?.active() ?? [];
		});
	}
	/** Returns the first error, as Nette stops at the first rule that fails. */
	validate() {
		for (const item of this.items) {
			if ("branch" in item) {
				const error = (item.validator(item.control, item.arg) ? item.branch : item.otherwise)?.validate() ?? null;
				if (error) return error;
				continue;
			}
			if (!CHECKS_EMPTY.has(item.validator) && !this.control.isFilled()) continue;
			if (!item.validator(this.control, item.arg)) return format(item.message ?? messages.get(item.validator) ?? "Please enter a valid value.", this.control, item.arg);
		}
		return null;
	}
	/** Visibility of toggled elements: shown when any rule says so. */
	collectToggles(into, active = true) {
		for (const [id, show] of this.toggles) into.set(id, (into.get(id) ?? false) || (active ? show : !show));
		for (const item of this.items) {
			if (!("branch" in item)) continue;
			const holds = item.validator(item.control, item.arg);
			item.branch.collectToggles(into, active && holds);
			item.otherwise?.collectToggles(into, active && !holds);
		}
	}
};
export { IMAGE_TYPES, Rules, fileChecks, messages, validators };
