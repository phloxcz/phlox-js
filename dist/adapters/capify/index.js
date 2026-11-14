import { FlashMessages } from "../../application/application.js";
// src/adapters/capify/index.ts
/**
* Adapter for @phloxcz/capify: flash messages shown as its toasts.
* It does not import capify, the application passes it in, so phlox-js itself has no dependency on it:
*
*   import * as Capify from '@phloxcz/capify';
*   services.add(new CapifyFlashMessages(Capify, { position: 'top-right' }));
*/
var TYPES = /* @__PURE__ */ new Set([
	"info",
	"success",
	"warning",
	"error"
]);
var CapifyFlashMessages = class extends FlashMessages {
	capify;
	options;
	handles = /* @__PURE__ */ new Map();
	constructor(capify, options = {}) {
		super();
		this.capify = capify;
		this.options = options;
		this.toasts = false;
	}
	/** Shows the message as a toast. It is not kept in `messages`, capify takes care of it and of its timer. */
	add(text, type = "info", options = {}) {
		const duration = options.duration ?? (type === "error" ? this.errorDuration : this.duration);
		const flash = {
			text,
			type,
			duration,
			...options.title ? { title: options.title } : {}
		};
		const handle = this.capify.notify(text, {
			...this.options,
			type: TYPES.has(type) ? type : "info",
			duration,
			...options.title ? { title: options.title } : {}
		});
		this.handles.set(flash, handle);
		return flash;
	}
	remove(flash) {
		this.handles.get(flash)?.close();
		this.handles.delete(flash);
	}
	clear() {
		for (const handle of this.handles.values()) handle.close();
		this.handles.clear();
	}
};
export { CapifyFlashMessages };
