import { batch } from "../reactive/reactive.js";
import { Checkbox, CheckboxList, FormControl, HiddenField, MultiSelectBox, RadioList, SelectBox, SubmitButton, TextArea, TextInput } from "./controls.js";
import { DropDownList } from "./dropdownlist.js";
import { ComboBox } from "./combobox.js";
import { TagInput } from "./taginput.js";
import { UploadControl } from "./upload.js";
import { EditorControl } from "./editor.js";
import { TreeSelect } from "./treeselect.js";
import { DropDownTreeSelect } from "./dropdowntree.js";
import { Multiplier } from "./multiplier.js";
import { validators } from "./rules.js";
// src/forms/container.ts
/**
* Container: a group of controls with its own part of the values, like Nette\Forms\Container.
* Form is a container too. addContainer() nests a DTO object, addMultiplier() a list of rows.
*/
var Container = class Container {
	owner;
	segment;
	/** Controls, containers and multipliers in the order they were added. */
	members = /* @__PURE__ */ new Map();
	/** Shown as the legend of the group by <FormView>. */
	label = "";
	constructor(owner = null, segment = "") {
		this.owner = owner;
		this.segment = segment;
	}
	get form() {
		return this.owner.form;
	}
	get idPrefix() {
		return `${this.owner.idPrefix}-${this.segment}`;
	}
	htmlName(name) {
		return `${this.owner.htmlName(this.segment)}[${name}]`;
	}
	/** Controls directly in this container, without buttons. */
	get controls() {
		return [...this.members.values()].filter((member) => member instanceof FormControl && !(member instanceof SubmitButton));
	}
	/** Adds an own control, the way the add*() methods do. */
	addControl(name, control) {
		this.checkName(name);
		control.form = this.form;
		control.container = this;
		control.name = name;
		if (control instanceof SubmitButton) this.form.buttons.set(name, control);
		else this.members.set(name, control);
		return control;
	}
	/** A nested group of controls for an object of the DTO, like $form->addContainer() in Nette. */
	addContainer(name, label = "") {
		this.checkName(name);
		const container = new Container(this, name);
		container.label = label;
		this.members.set(name, container);
		return container;
	}
	/**
	* Rows that the user adds, removes and orders, for a list of objects of the DTO.
	* `factory` adds the controls of one row, like addMultiplier() of contributte/forms-multiplier.
	*/
	addMultiplier(name, factory, options = {}) {
		this.checkName(name);
		const multiplier = new Multiplier(this, name, factory, options);
		this.members.set(name, multiplier);
		return multiplier;
	}
	addText(name, label = "", maxLength) {
		const control = this.addControl(name, new TextInput(label));
		if (maxLength !== void 0) control.addRule(validators.MaxLength, null, maxLength);
		return control;
	}
	addPassword(name, label = "") {
		return this.addControl(name, new TextInput(label)).setHtmlType("password");
	}
	addEmail(name, label = "") {
		return this.addControl(name, new TextInput(label)).setHtmlType("email").addRule(validators.Email);
	}
	addTextArea(name, label = "") {
		return this.addControl(name, new TextArea(label));
	}
	/** WYSIWYG editor, the value is HTML. Options of phlox-editor: toolbar, upload, placeholder… */
	addEditor(name, label = "", options = {}) {
		return this.addControl(name, new EditorControl(label, options));
	}
	/** A whole number, null when empty. */
	addInteger(name, label = "") {
		return this.addControl(name, new TextInput(label, "integer")).addRule(validators.Integer);
	}
	/** A number, also with a decimal comma, null when empty. */
	addFloat(name, label = "") {
		return this.addControl(name, new TextInput(label, "float")).addRule(validators.Float);
	}
	/** A date as text YYYY-MM-DD, the way a DTO receives it, null when empty. */
	addDate(name, label = "") {
		return this.addControl(name, new TextInput(label, "date"));
	}
	addCheckbox(name, caption = "") {
		return this.addControl(name, new Checkbox(caption));
	}
	addSelect(name, label = "", items = []) {
		return this.addControl(name, new SelectBox(label, items));
	}
	addMultiSelect(name, label = "", items = []) {
		return this.addControl(name, new MultiSelectBox(label, items));
	}
	addRadioList(name, label = "", items = []) {
		return this.addControl(name, new RadioList(label, items));
	}
	addCheckboxList(name, label = "", items = []) {
		return this.addControl(name, new CheckboxList(label, items));
	}
	/** A select with a search field, see DropDownList. Items are fixed, or come from `search`. */
	addDropDownList(name, label = "", options = {}) {
		return this.addControl(name, new DropDownList(label, options));
	}
	/**
	* A text field with suggestions, see ComboBox. The value is a picked item. `allowCustom` lets a typed text
	* be the value too, so it is allowed only for fields that can hold a text.
	*/
	addComboBox(name, label = "", options = {}) {
		return this.addControl(name, new ComboBox(label, options));
	}
	/**
	* Several values as tags, see TagInput. The field must be a list. `allowNew` makes tags of typed text,
	* so it is allowed only for lists that can hold texts.
	*/
	addTagInput(name, label = "", options = {}) {
		return this.addControl(name, new TagInput(label, options));
	}
	/** One file, File or null. Nothing is uploaded: onSuccess gets the File and sends it the way it needs. */
	addUpload(name, label = "") {
		return this.addControl(name, new UploadControl(label));
	}
	/** Several files, File[]. The number of them is checked by Form.MinLength and Form.MaxLength, as in Nette. */
	addMultiUpload(name, label = "") {
		return this.addControl(name, new UploadControl(label, true));
	}
	/** One node of a tree, its id or null. Nodes come at once (`nodes`) or level by level (`load`). */
	addTreeSelect(name, label = "", options = {}) {
		return this.addControl(name, new TreeSelect(label, options));
	}
	/**
	* One node of a tree in a drop-down: closed it shows the way to the picked node, open the tree.
	* A lazy tree needs `path`, so the way to a node set from code can be loaded.
	*/
	addDropDownTreeSelect(name, label = "", options = {}) {
		return this.addControl(name, new DropDownTreeSelect(label, options));
	}
	/** Several nodes of a tree, a list of ids. */
	addTreeMultiSelect(name, label = "", options = {}) {
		return this.addControl(name, new TreeSelect(label, options, true));
	}
	addHidden(name, value = "") {
		const control = this.addControl(name, new HiddenField());
		control.setValue(value);
		return control;
	}
	/** A button is not among the values. Several buttons can be told apart by isSubmittedBy(). */
	addSubmit(name, caption = "") {
		return this.addControl(name, new SubmitButton(caption));
	}
	get(name) {
		const member = this.members.get(name);
		if (!(member instanceof FormControl)) throw new Error(`The form has no control '${name}'.`);
		return member;
	}
	getContainer(name) {
		const member = this.members.get(name);
		if (!(member instanceof Container)) throw new Error(`The form has no container '${name}'.`);
		return member;
	}
	getMultiplier(name) {
		const member = this.members.get(name);
		if (!(member instanceof Multiplier)) throw new Error(`The form has no multiplier '${name}'.`);
		return member;
	}
	/** Values of the container, without disabled and omitted controls. Reads state, so a template follows it. */
	getValues() {
		const values = {};
		for (const [name, member] of this.members) if (member instanceof FormControl) {
			if (!member.omitted && !member.disabled()) values[name] = member.getValue();
		} else values[name] = member.getValues();
		return values;
	}
	/** Fills the controls, also nested containers and rows, typically with data loaded from the server. */
	setValues(values) {
		batch(() => {
			for (const [name, value] of Object.entries(values)) {
				const member = this.members.get(name);
				if (value === void 0 || !member) continue;
				if (member instanceof FormControl) member.setValue(value);
				else member.setValues(value);
			}
		});
		return this;
	}
	/** Checks all controls inside, also nested. Returns whether they are valid. */
	validateAll() {
		let valid = true;
		batch(() => {
			for (const member of this.members.values()) valid = (member instanceof FormControl ? member.validate() : member.validateAll()) && valid;
		});
		return valid;
	}
	hasErrors() {
		return [...this.members.values()].some((member) => member.hasErrors());
	}
	/** Empties all controls inside and their errors. */
	reset() {
		batch(() => {
			for (const member of this.members.values()) if (member instanceof FormControl) {
				member.setValue(Array.isArray(member.getValue()) ? [] : member instanceof Checkbox ? false : null);
				member.pristine();
			} else member.reset();
		});
	}
	/** Finds what a path from the server leads to, e.g. ['customer', 'city'] or ['lines', '2', 'quantity']. */
	resolve(path) {
		const [first, ...rest] = path;
		const member = first === void 0 ? void 0 : this.members.get(first);
		if (!member) return null;
		if (rest.length === 0) return member;
		return member instanceof FormControl ? null : member.resolve(rest);
	}
	/** Focuses the first control with an error. Returns whether there was one. */
	focusFirstError() {
		for (const member of this.members.values()) if (member instanceof FormControl) {
			if (member.hasErrors()) {
				member.focus();
				return true;
			}
		} else if (member.focusFirstError()) return true;
		return false;
	}
	/** Visibility of elements switched by toggle() in rules of the controls inside. */
	collectToggles(into) {
		for (const member of this.members.values()) if (member instanceof FormControl) member.rules.collectToggles(into);
		else member.collectToggles(into);
	}
	checkName(name) {
		if (this.members.has(name) || this.form.buttons.has(name)) throw new Error(`The form already has a control '${name}'.`);
	}
};
export { Container };
