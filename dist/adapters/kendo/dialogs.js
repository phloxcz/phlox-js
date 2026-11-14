import { effect } from "../../reactive/reactive.js";
import { h, insert } from "../../ui/dom.js";
import { Dialogs } from "../../ui/dialog.js";
import { renderComponent } from "../../ui/component.js";
import { Kendo } from "./kendo.js";
// src/adapters/kendo/dialogs.ts
/**
* KendoDialogs: dialogs of the framework in Kendo Window. Registered instead of the native <dialog>:
*
*   services.add(new Kendo(kendo), KendoDialogs);
*
* Components do not change: title() is the title of the window, render() its content, actions() its buttons.
*/
var KendoDialogs = class extends Dialogs {
	kendo;
	static $inject = () => [Kendo];
	constructor(kendo) {
		super();
		this.kendo = kendo;
	}
	show(dialog, options = {}) {
		const element = document.createElement("div");
		element.className = ["phlox-kendo-window", options.class].filter(Boolean).join(" ");
		dialog.scope.run(() => insert(element, [h("div", { class: "phlox-kendo-window-body" }, renderComponent(dialog)), h("div", { class: "k-actions k-actions-end phlox-kendo-window-actions" }, () => dialog.actions())], null));
		document.body.append(element);
		const side = options.placement === "end" || options.placement === "start";
		const window = this.kendo.create("Window", element, {
			modal: true,
			visible: false,
			title: "",
			actions: ["Close"],
			resizable: !side,
			draggable: !side,
			close: (event) => {
				if (!event.userTriggered) return;
				event.preventDefault();
				dialog.cancel();
			}
		});
		if (side) window.wrapper[0]?.classList.add("phlox-kendo-panel", `phlox-kendo-panel-${options.placement}`);
		dialog.scope.run(() => effect(() => {
			const title = dialog.title();
			window.title(typeof title === "string" || typeof title === "number" ? String(title) : "");
		}));
		window.center().open();
		return () => window.destroy();
	}
};
export { KendoDialogs };
