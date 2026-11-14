import { state, untrack } from "../../reactive/reactive.js";
import { FormControl } from "../../forms/controls.js";
import { KendoWidget } from "./widget.js";
import { jsx } from "../../jsx-runtime.js";
// src/adapters/kendo/control.tsx
/**
* KendoControl: a widget of Kendo UI as a control of a form. Rules, <Label>, <InputError>, errors from
* the server and values work as with the controls of the framework:
*
*   form.addControl('due', new KendoControl<Date | null>('DatePicker', 'Termín', { format: 'd. M. yyyy' }))
*     .setRequired('Vyberte termín.');
*/
var KendoControl = class extends FormControl {
	widget;
	options;
	current = state(null);
	/**
	* @param widget the name in kendo.ui, a widget with value(): 'DatePicker', 'DropDownList', 'NumericTextBox'…
	* @param options options of the widget, as in Kendo documentation
	*/
	constructor(widget, label = "", options = {}) {
		super(label);
		this.widget = widget;
		this.options = options;
	}
	getValue() {
		return this.current();
	}
	setValue(value) {
		this.current.set(value ?? null);
	}
	isFilled() {
		const value = this.current();
		return value !== null && value !== void 0 && value !== "" && !(Array.isArray(value) && value.length === 0);
	}
	render(attributes) {
		const { id, name, onBlur } = this.attrs();
		const value = Object.assign(() => this.current(), {
			set: (next) => {
				this.current.set(next ?? null);
				this.changed();
			},
			update: (change) => value.set(change(untrack(this.current)))
		});
		let host = null;
		return /* @__PURE__ */ jsx("span", {
			class: "phlox-kendo-control",
			ref: (element) => {
				host = element;
			},
			onFocusout: (event) => {
				if (host?.contains(event.relatedTarget)) return;
				onBlur(event);
			},
			children: /* @__PURE__ */ jsx(KendoWidget, {
				widget: this.widget,
				options: this.options,
				value,
				id,
				name,
				enabled: () => !this.disabled(),
				class: this.classFor(attributes, "kendo"),
				onCreate: (_widget, element) => {
					this.element = element;
				}
			})
		});
	}
};
export { KendoControl };
