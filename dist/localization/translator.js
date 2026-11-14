// src/localization/translator.ts
var Translator = class {};
function escapeHtml(text) {
	return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
/**
* Translator over messages in a plain object, usually a JSON file per language.
* - `{name}` in a message is replaced by a parameter, numbers are formatted for the locale.
* - A plural is an object such as `{ one, few, other }`, the form is chosen by the parameter `count`.
*/
var IntlTranslator = class extends Translator {
	locale;
	messages;
	plural;
	number;
	constructor(locale, messages) {
		super();
		this.setLocale(locale, messages);
	}
	/** Switches the language. What is already rendered keeps its texts, call app.restart() afterwards. */
	setLocale(locale, messages) {
		this.locale = locale;
		this.messages = messages;
		this.plural = new Intl.PluralRules(locale);
		this.number = new Intl.NumberFormat(locale);
	}
	/** The same as translate(), with checked keys and bound, so it can be exported as `t`. */
	t = (key, params) => this.translate(key, params);
	/** For messages that contain HTML. The message is trusted, parameters are escaped. */
	html = (key, params) => {
		const template = document.createElement("template");
		template.innerHTML = this.format(key, params, escapeHtml);
		return template.content;
	};
	translate(key, params) {
		return this.format(key, params, (text) => text);
	}
	format(key, params = {}, escape) {
		let message = this.messages;
		for (const part of key.split(".")) message = typeof message === "object" && Object.hasOwn(message, part) ? message[part] : void 0;
		if (typeof message === "object" && typeof message.other === "string") {
			const form = message[this.plural.select(Number(params.count))];
			message = typeof form === "string" ? form : message.other;
		}
		if (typeof message !== "string") {
			console.warn(`Missing translation '${key}' for locale '${this.locale}'.`);
			return key;
		}
		return message.replace(/\{(\w+)\}/g, (placeholder, name) => {
			const value = params[name];
			if (value === void 0) return placeholder;
			return typeof value === "number" ? this.number.format(value) : escape(value);
		});
	}
};
export { IntlTranslator, Translator };
