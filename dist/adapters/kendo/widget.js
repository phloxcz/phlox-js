import { effect, untrack } from "../../reactive/reactive.js";
import { Component } from "../../ui/component.js";
import { Kendo, sameValue } from "./kendo.js";
import { jsx } from "../../jsx-runtime.js";
// src/adapters/kendo/widget.tsx
/**
* <KendoWidget>: any widget of Kendo UI in a template, bound to state both ways, like knockout-kendo.
* The widget is made once the element is in the page and destroyed when its part of the template goes away.
*/
/** Widgets made on an <input>; the others on a <div>. */
var INPUTS = /* @__PURE__ */ new Set([
	"AutoComplete",
	"ColorPicker",
	"ComboBox",
	"DateInput",
	"DatePicker",
	"DateRangePicker",
	"DateTimePicker",
	"DropDownList",
	"MaskedTextBox",
	"MultiColumnComboBox",
	"MultiSelect",
	"NumericTextBox",
	"Switch",
	"TextBox",
	"TimePicker",
	"Rating",
	"CheckBox",
	"RadioButton",
	"TextArea",
	"Slider"
]);
var KendoWidget = class extends Component {
	kendo;
	static $inject = () => [Kendo];
	/** The widget, null until the element is in the page. */
	widget = null;
	host;
	constructor(kendo) {
		super();
		this.kendo = kendo;
	}
	render() {
		return /* @__PURE__ */ jsx("span", {
			class: () => ["phlox-kendo", read(this.props.class)].filter(Boolean).join(" "),
			ref: (element) => {
				this.host = element;
			}
		});
	}
	afterRender() {
		const { props } = this;
		const element = document.createElement(props.tag ?? (INPUTS.has(props.widget) ? "input" : "div"));
		if (props.id) element.id = props.id;
		if (props.name) element.setAttribute("name", props.name);
		this.host.append(element);
		const widget = this.widget = this.kendo.create(props.widget, element, props.options ?? {});
		this.scope.onCleanup(() => {
			widget.destroy();
			this.host.replaceChildren();
		});
		const { value, enabled } = props;
		this.scope.run(() => {
			if (value && widget.value) {
				widget.bind("change", () => value.set(widget.value()));
				effect(() => {
					const next = value();
					if (!sameValue(untrack(() => widget.value()), next)) widget.value(next);
				});
			}
			if (enabled !== void 0 && widget.enable) effect(() => widget.enable(Boolean(read(enabled))));
		});
		props.onCreate?.(widget, element);
	}
};
function read(value) {
	return typeof value === "function" ? value() : value;
}
export { KendoWidget };
