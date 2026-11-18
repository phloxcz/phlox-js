import { For, If } from "../ui/flow.js";
import { computed, onCleanup, state } from "../reactive/reactive.js";
import { classes, currentTheme } from "../ui/theme.js";
import { FormControl } from "./controls.js";
import { IMAGE_TYPES, fileChecks, validators } from "./rules.js";
import { texts } from "../ui/texts.js";
import { jsx } from "../jsx-runtime.js";
// src/forms/upload.tsx
/**
* Choosing files, like addUpload() and addMultiUpload() in Nette. The look is taken over from phloxcz/components-upload:
* a drop zone with a button, and a table of the chosen files. Nothing is uploaded here: the value is the File objects,
* and onSuccess decides how to send them (chunks over RPC, a stream to REST...).
*/
var UPLOAD_ICON = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"40\" height=\"40\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><polyline points=\"17 8 12 3 7 8\"/><line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"15\"/></svg>";
var REMOVE_ICON = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/></svg>";
/** Size for people, like in phloxcz/components-upload: 512 B, 1.5 KB, 3.2 MB. */
function formatFileSize(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
	return `${(bytes / 1073741824).toFixed(1)} GB`;
}
/** The same file chosen twice is added once. */
var sameFile = (a, b) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
/** One file (File | null) or several (File[]). */
var UploadControl = class UploadControl extends FormControl {
	multiple;
	static texts = texts("upload", {
		dropzone: "Upload area – click or drop files here",
		heading: "Drop files here",
		or: "or",
		browseMultiple: "Choose files",
		browseSingle: "Choose a file",
		remove: "Remove %s"
	});
	files = state([]);
	/** The accept attribute, from the rules MimeType and Image, as in Nette. */
	accept = computed(() => this.rules.active().flatMap(({ validator, arg }) => {
		if (validator === validators.Image) return IMAGE_TYPES;
		if (validator === validators.MimeType) return (Array.isArray(arg) ? arg : [arg]).map(String);
		return [];
	}).join(", "));
	constructor(label = "", multiple = false) {
		super(label);
		this.multiple = multiple;
	}
	getValue() {
		const files = this.files();
		return this.multiple ? files : files[0] ?? null;
	}
	setValue(value) {
		this.files.set(value === null || value === void 0 ? [] : Array.isArray(value) ? [...value] : [value]);
	}
	isFilled() {
		return this.files().length > 0;
	}
	/** Adds chosen or dropped files. A single upload keeps only the last one. The rules are checked at once. */
	addFiles(files) {
		const added = [...files];
		if (!added.length) return;
		if (this.multiple) this.files.update((current) => [...current, ...added.filter((file) => !current.some((other) => sameFile(file, other)))]);
		else this.files.set([added[0]]);
		this.edited = true;
		this.validate();
	}
	removeFile(file) {
		this.files.update((current) => current.filter((other) => other !== file));
		this.changed();
	}
	/** Whether the file meets the rules about one file (size, type), for marking it in the list. */
	isValidFile(file) {
		return this.rules.active().every(({ validator, arg }) => fileChecks.get(validator)?.(file, arg) ?? true);
	}
	render(attributes) {
		const { id, name, ref, onBlur, required: _required, disabled: _disabled, ...common } = this.attrs();
		const theme = currentTheme();
		const slot = (part) => theme.class(`upload.${part}`);
		const texts = UploadControl.texts;
		const dragging = state(false);
		let wrapper;
		let input;
		const locked = () => this.disabled() || this.readOnly();
		const open = () => {
			if (!locked()) input.click();
		};
		return /* @__PURE__ */ jsx("div", {
			class: classes("pu-wrapper", slot("wrapper"), attributes.class),
			"data-phlox-upload": true,
			ref: (element) => {
				wrapper = element;
			},
			onFocusout: (event) => {
				if (wrapper.contains(event.relatedTarget)) return;
				onBlur(event);
			},
			children: [/* @__PURE__ */ jsx("div", {
				...common,
				class: () => classes("pu-dropzone", slot("dropzone"), dragging() ? slot("dropzoneActive") : slot("dropzoneIdle"), this.hasErrors() && theme.class("invalid")),
				role: "button",
				tabIndex: 0,
				"aria-label": texts.dropzone,
				"aria-disabled": () => this.disabled() ? "true" : null,
				"aria-readonly": () => this.readOnly() ? "true" : null,
				ref,
				onClick: open,
				onKeydown: (event) => {
					if (event.key !== "Enter" && event.key !== " " || event.target !== event.currentTarget) return;
					event.preventDefault();
					open();
				},
				onDragover: (event) => {
					event.preventDefault();
					if (!locked()) dragging.set(true);
				},
				onDragleave: (event) => {
					if (!event.currentTarget.contains(event.relatedTarget)) dragging.set(false);
				},
				onDrop: (event) => {
					event.preventDefault();
					dragging.set(false);
					if (!locked()) this.addFiles(event.dataTransfer?.files ?? []);
				},
				children: [
					/* @__PURE__ */ jsx("div", {
						class: "pu-dropzone-icon",
						"aria-hidden": "true",
						ref: (element) => {
							element.innerHTML = UPLOAD_ICON;
						}
					}),
					/* @__PURE__ */ jsx("p", {
						class: "pu-dropzone-hint",
						children: [
							/* @__PURE__ */ jsx("strong", { children: texts.heading }),
							/* @__PURE__ */ jsx("br", {}),
							/* @__PURE__ */ jsx("span", { children: texts.or })
						]
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						class: classes("pu-browse-btn", slot("button")),
						tabIndex: -1,
						disabled: this.disabled,
						hidden: this.readOnly,
						children: this.multiple ? texts.browseMultiple : texts.browseSingle
					}),
					/* @__PURE__ */ jsx("input", {
						type: "file",
						class: "pu-file-input",
						id,
						name,
						multiple: this.multiple,
						accept: () => this.accept() || null,
						disabled: this.disabled,
						"aria-hidden": "true",
						tabIndex: -1,
						ref: (element) => {
							input = element;
						},
						onClick: (event) => event.stopPropagation(),
						onChange: () => {
							this.addFiles(input.files ?? []);
							input.value = "";
						}
					})
				]
			}), /* @__PURE__ */ jsx(If, {
				when: () => this.files().length,
				children: /* @__PURE__ */ jsx("table", {
					class: classes("pu-table", slot("table")),
					children: /* @__PURE__ */ jsx("tbody", { children: /* @__PURE__ */ jsx(For, {
						each: this.files,
						children: (file) => /* @__PURE__ */ jsx("tr", {
							class: () => classes("pu-table-row", this.isValidFile(file) ? slot("row") : slot("rowError")),
							"data-phlox-upload-file": true,
							children: [
								/* @__PURE__ */ jsx("td", {
									class: classes("pu-cell-name", slot("cellName")),
									title: file.name,
									children: [preview(file), file.name]
								}),
								/* @__PURE__ */ jsx("td", {
									class: classes("pu-cell-size", slot("cellSize")),
									children: formatFileSize(file.size)
								}),
								/* @__PURE__ */ jsx("td", {
									class: classes("pu-cell-remove", slot("cellRemove")),
									children: /* @__PURE__ */ jsx("button", {
										type: "button",
										class: classes("pu-row-remove", slot("remove")),
										"aria-label": texts.remove.replace("%s", file.name),
										title: texts.remove.replace("%s", file.name),
										disabled: this.disabled,
										hidden: this.readOnly,
										ref: (element) => {
											element.innerHTML = REMOVE_ICON;
										},
										onClick: () => this.removeFile(file)
									})
								})
							]
						})
					}) })
				})
			})]
		});
	}
};
/** A small preview of an image. The address is released when the file leaves the list. */
function preview(file) {
	if (!IMAGE_TYPES.includes(file.type) || typeof URL.createObjectURL !== "function") return null;
	const url = URL.createObjectURL(file);
	onCleanup(() => URL.revokeObjectURL(url));
	return /* @__PURE__ */ jsx("img", {
		class: "pu-thumb",
		src: url,
		alt: ""
	});
}
export { UploadControl, formatFileSize };
