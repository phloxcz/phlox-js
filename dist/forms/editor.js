import { effect, state, untrack } from "../reactive/reactive.js";
import { Component } from "../ui/component.js";
import { reveal } from "../ui/reveal.js";
import { currentTheme } from "../ui/theme.js";
import { FormControl } from "./controls.js";
import { jsx } from "../jsx-runtime.js";
// src/forms/editor.tsx
var loading = null;
/** The editor library and its CSS, loaded once. */
function loadEditor() {
	loading ??= Promise.all([import("@phloxcz/forms-editor"), import("@phloxcz/forms-editor/wysiwyg.css")]).then(([library]) => {
		library.autoInit(false);
		return library;
	});
	return loading;
}
/** <Editor value={text} options={{ toolbar: 'format,lists' }} />: HTML bound to state both ways. */
var Editor = class Editor extends Component {
	/** Options of every editor of the application, e.g. { upload } or { colorScheme: 'auto' }. Its own options go over them. */
	static defaults = {};
	/** The editor, null until it is loaded and the element is in the page. */
	editor = null;
	host;
	theme = "default";
	render() {
		this.theme = currentTheme().editorTheme;
		return /* @__PURE__ */ jsx("div", {
			class: this.props.class,
			children: /* @__PURE__ */ jsx("div", { ref: (element) => {
				this.host = element;
			} })
		});
	}
	afterRender() {
		loadEditor().then((library) => this.scope.disposed || this.create(library), (error) => this.app.onError(error));
	}
	create(library) {
		const { value, enabled, readOnly, options, name, label } = this.props;
		const editor = this.editor = new library.PhloxEditor(this.host, {
			theme: this.theme,
			...Editor.defaults,
			...options,
			name: name ?? "",
			value: value ? untrack(value) : ""
		});
		const pane = this.host.querySelector("[contenteditable]");
		pane?.setAttribute("role", "textbox");
		pane?.setAttribute("aria-multiline", "true");
		if (label) pane?.setAttribute("aria-label", label);
		const changed = (event) => value?.set(event.detail.value);
		this.host.addEventListener("phx-editor:change", changed);
		this.scope.onCleanup(() => {
			this.host.removeEventListener("phx-editor:change", changed);
			editor.destroy();
		});
		this.scope.run(() => {
			if (value) effect(() => {
				const next = value() ?? "";
				if (next !== editor.getValue()) editor.setValue(next);
			});
			if (enabled !== void 0) effect(() => {
				const on = Boolean(typeof enabled === "function" ? enabled() : enabled);
				this.host.inert = !on;
				this.host.classList.toggle("phlox-editor-disabled", !on);
			});
			if (readOnly !== void 0 && pane) effect(() => {
				const read = Boolean(typeof readOnly === "function" ? readOnly() : readOnly);
				pane.contentEditable = read ? "false" : "true";
				pane.setAttribute("aria-readonly", String(read));
				this.host.classList.toggle("phlox-editor-readonly", read);
			});
		});
		this.props.onCreate?.(editor, pane);
	}
};
/**
* The editor as a control of a form, its value is HTML. Made by form.addEditor('text', 'Komentář', options);
* rules, <Label>, <InputError> and errors from the server work as with the other controls.
*/
var EditorControl = class extends FormControl {
	options;
	current = state("");
	/** The editor while it is shown, e.g. for insertText(). */
	editor = null;
	/** focus() came before the editor was loaded: it gets the focus once it is there. */
	focusWhenReady = false;
	constructor(label = "", options = {}) {
		super(label);
		this.options = options;
	}
	getValue() {
		return this.current();
	}
	setValue(value) {
		this.current.set(value ?? "");
	}
	/** The editor is loaded lazily: focus() before that puts the focus in as soon as it is made. */
	focus() {
		if (this.element?.isConnected) {
			reveal(this.element);
			this.element.focus();
		} else this.focusWhenReady = true;
	}
	/** Text, or an image, a table… An empty editor gives '', but HTML from elsewhere can be just <p></p>. */
	isFilled() {
		const html = this.current();
		return /<(img|hr|table|iframe|video)\b/i.test(html) || html.replace(/<[^>]*>|&nbsp;/g, "").trim() !== "";
	}
	render(attributes) {
		const { name, onBlur } = this.attrs();
		const value = Object.assign(() => this.current(), {
			set: (next) => {
				this.current.set(next);
				this.changed();
			},
			update: (change) => value.set(change(untrack(this.current)))
		});
		let host = null;
		return /* @__PURE__ */ jsx("div", {
			class: "phlox-editor-control",
			"aria-invalid": () => this.hasErrors() ? "true" : null,
			ref: (element) => {
				host = element;
			},
			onFocusout: (event) => {
				if (host?.contains(event.relatedTarget)) return;
				onBlur(event);
			},
			children: /* @__PURE__ */ jsx(Editor, {
				value,
				options: this.options,
				name,
				label: this.label,
				enabled: () => !this.disabled(),
				readOnly: this.readOnly,
				class: this.classFor(attributes, "editor"),
				onCreate: (editor, pane) => {
					this.editor = editor;
					this.element = pane;
					if (pane) pane.id = this.htmlId;
					if (this.focusWhenReady) {
						this.focusWhenReady = false;
						reveal(pane);
						pane?.focus();
					}
				}
			})
		});
	}
};
export { Editor, EditorControl };
