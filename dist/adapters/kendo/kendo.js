// src/adapters/kendo/kendo.ts
var Kendo = class {
	kendo;
	constructor(kendo) {
		this.kendo = kendo;
	}
	/** Makes a widget, e.g. create('DatePicker', input, { format: 'd. M. yyyy' }). */
	create(name, element, options = {}) {
		const Widget = this.kendo.ui[name];
		if (typeof Widget !== "function") throw new Error(`Kendo UI has no widget '${name}', is it loaded?`);
		return new Widget(element, options);
	}
};
/** Whether two values of a widget are the same: dates by time, lists by content. */
function sameValue(a, b) {
	if (Object.is(a, b)) return true;
	if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
	if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
	return (a === null || a === void 0 || a === "") && (b === null || b === void 0 || b === "");
}
export { Kendo, sameValue };
