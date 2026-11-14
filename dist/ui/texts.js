// src/ui/texts.ts
var registered = /* @__PURE__ */ new Map();
var current = {};
/** Registers the texts of a part of the framework and returns them, in the language set so far. */
function texts(name, defaults) {
	registered.set(name, defaults);
	Object.assign(defaults, current[name]);
	return defaults;
}
/**
* Texts of the framework in another language, before the application starts:
*
*   import cs from 'phlox-js/locales/cs';
*   setTexts(cs);
*
* Single texts can be changed afterwards as before: DropDownList.texts.noResults = '…'.
*/
function setTexts(locale) {
	const parts = locale;
	current = {
		...current,
		...parts
	};
	for (const [name, holder] of registered) Object.assign(holder, parts[name]);
}
export { setTexts, texts };
