import { For, If } from "../ui/flow.js";
import { effect, getScope, untrack } from "../reactive/reactive.js";
import { insert } from "../ui/dom.js";
import { APP } from "../ui/component.js";
import { classes, currentTheme } from "../ui/theme.js";
import { dragToSort } from "../ui/sortable.js";
import { FormControl, HiddenField } from "./controls.js";
import { Multiplier } from "./multiplier.js";
import { jsx } from "../jsx-runtime.js";
// src/forms/render.tsx
/** Rendering of forms: automatic <FormView>, or by hand with <FormTag>, <Label>, <Input> and <InputError>. */
/** The <form> element, like {form} in Latte. Sending it validates the form and calls onSuccess. */
function FormTag(props) {
	const { form, children, ...attributes } = props;
	const app = getScope()?.find(APP);
	return /* @__PURE__ */ jsx("form", {
		...attributes,
		id: form.id,
		noValidate: true,
		ref: (element) => {
			form.element = element;
			form.markRendered();
			effect(() => {
				for (const [id, show] of form.toggles()) (element.querySelector(`[id="${id.replace(/"/g, "\\\"")}"]`) ?? document.getElementById(id))?.toggleAttribute("hidden", !show);
			});
		},
		onSubmit: (event) => {
			event.preventDefault();
			const button = form.clickedButton;
			form.clickedButton = null;
			form.submit(button).catch((error) => app ? app.onError(error) : console.error(error));
		},
		onKeydown: (event) => {
			const target = event.target;
			if (event.key !== "Enter" || event.defaultPrevented || event.isComposing) return;
			if (!(target instanceof HTMLInputElement) || /^(button|submit|reset|checkbox|radio|file|image)$/.test(target.type)) return;
			if (event.currentTarget.querySelector("[type=submit], input[type=image]")) return;
			event.preventDefault();
			form.submit().catch((error) => app ? app.onError(error) : console.error(error));
		},
		children
	});
}
/** Like {label name} in Latte. A required control has the class `required`. */
function Label(props) {
	const { control } = props;
	return /* @__PURE__ */ jsx("label", {
		for: control.htmlId,
		class: classes(currentTheme().class("label"), control.isRequired() && "required") || null,
		children: props.children ?? control.label
	});
}
/**
* Like {input name} in Latte. Other attributes go to the element: <Input control={...} class="wide" />.
* `ref` gets the element the user works with (control.element), the control keeps its own reference too.
*/
function Input(props) {
	const { control, ref, ...attributes } = props;
	if (typeof ref !== "function") return control.render(attributes);
	const fragment = document.createDocumentFragment();
	insert(fragment, control.render(attributes), null);
	ref(control.element);
	return fragment;
}
/** Like {inputError name} in Latte: the error of the control, shown only while there is one. */
function InputError(props) {
	const { control } = props;
	return /* @__PURE__ */ jsx(If, {
		when: () => control.errors().length,
		children: /* @__PURE__ */ jsx("span", {
			class: currentTheme().class("error"),
			id: `${control.htmlId}-error`,
			children: () => control.errors()[0]
		})
	});
}
/** Errors of the whole form, e.g. from the server. */
function FormErrors(props) {
	return /* @__PURE__ */ jsx(If, {
		when: () => props.form.errors().length,
		children: /* @__PURE__ */ jsx("ul", {
			class: currentTheme().class("formErrors"),
			role: "alert",
			children: /* @__PURE__ */ jsx(For, {
				each: props.form.errors,
				children: (error) => /* @__PURE__ */ jsx("li", { children: error })
			})
		})
	});
}
/**
* The whole form, like {control form} in Latte. Every control gets a row with the id `<control id>-pair`,
* which toggle() can use. Containers become groups, multipliers rows that can be added and ordered.
*/
function FormView(props) {
	const { form, ...attributes } = props;
	const theme = currentTheme();
	return /* @__PURE__ */ jsx(FormTag, {
		form,
		class: theme.class("form") || null,
		...attributes,
		children: [
			/* @__PURE__ */ jsx(FormErrors, { form }),
			renderMembers(form),
			/* @__PURE__ */ jsx("div", {
				class: theme.class("formButtons"),
				children: [...form.buttons.values()].map((button) => /* @__PURE__ */ jsx(Input, { control: button }))
			})
		]
	});
}
/** A label, the control and its error, like a row of {control form}. */
function ControlRow(props) {
	const { control } = props;
	return /* @__PURE__ */ jsx("div", {
		class: currentTheme().class(props.slot),
		id: `${control.htmlId}-pair`,
		children: [
			control.labelInInput ? null : /* @__PURE__ */ jsx(Label, { control }),
			/* @__PURE__ */ jsx(Input, { control }),
			/* @__PURE__ */ jsx(InputError, { control })
		]
	});
}
/** Members of a container: controls as rows, containers as groups, multipliers as rows to add and order. */
function renderMembers(container, slot = "formRow") {
	const theme = currentTheme();
	return [...container.members.values()].map((member) => {
		if (member instanceof HiddenField) return /* @__PURE__ */ jsx(Input, { control: member });
		if (member instanceof FormControl) return /* @__PURE__ */ jsx(ControlRow, {
			control: member,
			slot
		});
		if (member instanceof Multiplier) return /* @__PURE__ */ jsx(MultiplierView, { multiplier: member });
		return /* @__PURE__ */ jsx("fieldset", {
			class: theme.class("group"),
			id: `${member.idPrefix}-pair`,
			children: [member.label ? /* @__PURE__ */ jsx("legend", {
				class: theme.class("legend"),
				children: member.label
			}) : null, renderMembers(member)]
		});
	});
}
/** Errors of the rows as a whole, e.g. too few of them. */
function MultiplierErrors(props) {
	const { multiplier } = props;
	return /* @__PURE__ */ jsx(If, {
		when: () => multiplier.errors().length,
		children: /* @__PURE__ */ jsx("div", {
			class: currentTheme().class("error"),
			role: "alert",
			id: `${multiplier.idPrefix}-error`,
			children: () => multiplier.errors()[0]
		})
	});
}
/**
* Rows of a multiplier with buttons to add, remove and move them, and a handle to drag them.
* Without children every row shows its controls with labels. With children the row is drawn by them:
* <MultiplierView multiplier={lines}>{row => <Input control={row.get('name')} />}</MultiplierView>.
*/
function MultiplierView(props) {
	const { multiplier } = props;
	const theme = currentTheme();
	const texts = Multiplier.texts;
	let list;
	const elements = () => [...list.children].filter((child) => child instanceof HTMLElement);
	return /* @__PURE__ */ jsx("fieldset", {
		class: theme.class("multiplier"),
		id: `${multiplier.idPrefix}-pair`,
		children: [
			multiplier.label ? /* @__PURE__ */ jsx("legend", {
				class: theme.class("legend"),
				children: multiplier.label
			}) : null,
			/* @__PURE__ */ jsx(MultiplierErrors, { multiplier }),
			/* @__PURE__ */ jsx("div", {
				role: "list",
				ref: (element) => {
					list = element;
				},
				children: /* @__PURE__ */ jsx(For, {
					each: multiplier.rows,
					children: (row, index) => {
						let element;
						let handle;
						const moveBy = (step) => {
							multiplier.move(row, untrack(index) + step);
							queueMicrotask(() => handle.focus());
						};
						return /* @__PURE__ */ jsx("div", {
							class: theme.class("multiplierRow"),
							role: "listitem",
							"data-phlox-row": true,
							ref: (el) => {
								element = el;
							},
							children: [
								/* @__PURE__ */ jsx("button", {
									type: "button",
									class: theme.class("multiplierHandle"),
									"aria-label": () => `${texts.drag} (${index() + 1})`,
									title: texts.drag,
									ref: (el) => {
										handle = el;
									},
									onPointerdown: (event) => dragToSort(event, element, {
										items: elements,
										move: (to) => multiplier.move(row, to)
									}),
									onKeydown: (event) => {
										if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
										event.preventDefault();
										moveBy(event.key === "ArrowUp" ? -1 : 1);
									},
									children: "⠿"
								}),
								/* @__PURE__ */ jsx("div", {
									class: theme.class("multiplierFields"),
									children: props.children ? props.children(row, index) : renderMembers(row, "multiplierField")
								}),
								/* @__PURE__ */ jsx("div", {
									class: theme.class("multiplierButtons"),
									children: [
										/* @__PURE__ */ jsx("button", {
											type: "button",
											class: theme.class("multiplierButton"),
											"aria-label": texts.moveUp,
											title: texts.moveUp,
											disabled: () => index() === 0,
											onClick: () => moveBy(-1),
											children: "↑"
										}),
										/* @__PURE__ */ jsx("button", {
											type: "button",
											class: theme.class("multiplierButton"),
											"aria-label": texts.moveDown,
											title: texts.moveDown,
											disabled: () => index() === multiplier.rows().length - 1,
											onClick: () => moveBy(1),
											children: "↓"
										}),
										/* @__PURE__ */ jsx("button", {
											type: "button",
											class: theme.class("multiplierButton"),
											"aria-label": texts.remove,
											title: texts.remove,
											disabled: () => !multiplier.canRemove(),
											onClick: () => multiplier.remove(row),
											children: "×"
										})
									]
								})
							]
						});
					}
				})
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				class: theme.class("multiplierAdd"),
				disabled: () => !multiplier.canAdd(),
				onClick: () => {
					const row = multiplier.add();
					if (row) queueMicrotask(() => row.controls[0]?.element?.focus());
				},
				children: ["+ ", texts.add]
			})
		]
	});
}
export { FormErrors, FormTag, FormView, Input, InputError, Label, MultiplierErrors, MultiplierView };
