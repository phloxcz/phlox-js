/**
 * Container: a group of controls with its own part of the values, like Nette\Forms\Container.
 * Form is a container too. addContainer() nests a DTO object, addMultiplier() a list of rows.
 */

import { batch } from '../reactive/reactive';
import {
  Checkbox, CheckboxList, FormControl, HiddenField, MultiSelectBox, RadioList, SelectBox, SubmitButton, TextArea, TextInput,
} from './controls';
import type { Items } from './controls';
import { DropDownList } from './dropdownlist';
import type { DropDownListOptions } from './dropdownlist';
import { ComboBox } from './combobox';
import type { ComboBoxOptions } from './combobox';
import { TagInput } from './taginput';
import { UploadControl } from './upload';
import { TreeSelect } from './treeselect';
import type { TreeSelectOptions } from './treeselect';
import { DropDownTreeSelect } from './dropdowntree';
import type { DropDownTreeSelectOptions } from './dropdowntree';
import type { TreeKey } from '../components/tree';
import type { TagInputOptions } from './taginput';
import { Multiplier } from './multiplier';
import type { MultiplierOptions } from './multiplier';
import { validators } from './rules';
import type { Form } from './form';

/** Names of the values of V that can hold a T: addText() needs a text field of the DTO, addInteger() a number. */
export type KeysFor<V, T> = { [K in keyof V]-?: T extends V[K] ? K : never }[keyof V] & string;
export type ListKeys<V> = { [K in keyof V]-?: NonNullable<V[K]> extends readonly unknown[] ? K : never }[keyof V] & string;
export type ItemOf<L> = NonNullable<L> extends readonly (infer E)[] ? E : never;
/** Names of nested objects of V, for addContainer(). */
export type ObjectKeys<V> = {
  [K in keyof V]-?: NonNullable<V[K]> extends readonly unknown[] ? never : NonNullable<V[K]> extends object ? K : never;
}[keyof V] & string;
/** Names of lists of objects of V, for addMultiplier(). */
/** Values that may leave out any field, also in nested objects and rows. Defaults are usually incomplete. */
export type DeepPartial<T> = T extends readonly (infer E)[] ? DeepPartial<E>[] : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
export type RowListKeys<V> = { [K in ListKeys<V>]: ItemOf<V[K]> extends object ? K : never }[ListKeys<V>] & string;

/** What a container belongs to: the form, a parent container, or a multiplier for its rows. */
export interface Owner {
  readonly form: Form<any>;
  /** Start of the ids of the elements inside, so they are unique in the page. */
  readonly idPrefix: string;
  /** The name attribute of a member, like customer[city] in Nette. */
  htmlName(name: string): string;
}

export type Member = FormControl<any> | Container<any> | Multiplier<any>;

export class Container<V extends object = Record<string, any>> implements Owner {
  /** Controls, containers and multipliers in the order they were added. */
  readonly members = new Map<string, Member>();
  /** Shown as the legend of the group by <FormView>. */
  label = '';

  constructor(private owner: Owner | null = null, private segment = '') {}

  get form(): Form<any> {
    return this.owner!.form;
  }

  get idPrefix(): string {
    return `${this.owner!.idPrefix}-${this.segment}`;
  }

  htmlName(name: string): string {
    return `${this.owner!.htmlName(this.segment)}[${name}]`;
  }

  /** Controls directly in this container, without buttons. */
  get controls(): FormControl<any>[] {
    return [...this.members.values()].filter((member): member is FormControl<any> =>
      member instanceof FormControl && !(member instanceof SubmitButton));
  }

  /** Adds an own control, the way the add*() methods do. */
  addControl<C extends FormControl<any>>(name: string, control: C): C {
    this.checkName(name);
    control.form = this.form;
    control.container = this;
    control.name = name;
    if (control instanceof SubmitButton) this.form.buttons.set(name, control);
    else this.members.set(name, control);
    return control;
  }

  /** A nested group of controls for an object of the DTO, like $form->addContainer() in Nette. */
  addContainer<K extends ObjectKeys<V>>(name: K, label = ''): Container<NonNullable<V[K]>> {
    this.checkName(name);
    const container = new Container<NonNullable<V[K]>>(this, name);
    container.label = label;
    this.members.set(name, container);
    return container;
  }

  /**
   * Rows that the user adds, removes and orders, for a list of objects of the DTO.
   * `factory` adds the controls of one row, like addMultiplier() of contributte/forms-multiplier.
   */
  addMultiplier<K extends RowListKeys<V>>(
    name: K,
    factory: (row: Container<ItemOf<V[K]> & object>) => void,
    options: MultiplierOptions = {},
  ): Multiplier<ItemOf<V[K]> & object> {
    this.checkName(name);
    const multiplier = new Multiplier<ItemOf<V[K]> & object>(this, name, factory, options);
    this.members.set(name, multiplier);
    return multiplier;
  }

  addText(name: KeysFor<V, string>, label = '', maxLength?: number): TextInput<string> {
    const control = this.addControl(name, new TextInput<string>(label));
    if (maxLength !== undefined) control.addRule(validators.MaxLength, null, maxLength);
    return control;
  }

  addPassword(name: KeysFor<V, string>, label = ''): TextInput<string> {
    return this.addControl(name, new TextInput<string>(label)).setHtmlType('password');
  }

  addEmail(name: KeysFor<V, string>, label = ''): TextInput<string> {
    return this.addControl(name, new TextInput<string>(label)).setHtmlType('email').addRule(validators.Email);
  }

  addTextArea(name: KeysFor<V, string>, label = ''): TextArea {
    return this.addControl(name, new TextArea(label));
  }

  /** A whole number, null when empty. */
  addInteger(name: KeysFor<V, number | null>, label = ''): TextInput<number | null> {
    return this.addControl(name, new TextInput<number | null>(label, 'integer')).addRule(validators.Integer);
  }

  /** A number, also with a decimal comma, null when empty. */
  addFloat(name: KeysFor<V, number | null>, label = ''): TextInput<number | null> {
    return this.addControl(name, new TextInput<number | null>(label, 'float')).addRule(validators.Float);
  }

  /** A date as text YYYY-MM-DD, the way a DTO receives it, null when empty. */
  addDate(name: KeysFor<V, string | null>, label = ''): TextInput<string | null> {
    return this.addControl(name, new TextInput<string | null>(label, 'date'));
  }

  addCheckbox(name: KeysFor<V, boolean>, caption = ''): Checkbox {
    return this.addControl(name, new Checkbox(caption));
  }

  addSelect<K extends keyof V & string>(name: K, label = '', items: Items<NonNullable<V[K]>> = []): SelectBox<NonNullable<V[K]>> {
    return this.addControl(name, new SelectBox<NonNullable<V[K]>>(label, items));
  }

  addMultiSelect<K extends ListKeys<V>>(name: K, label = '', items: Items<ItemOf<V[K]>> = []): MultiSelectBox<ItemOf<V[K]>> {
    return this.addControl(name, new MultiSelectBox<ItemOf<V[K]>>(label, items));
  }

  addRadioList<K extends keyof V & string>(name: K, label = '', items: Items<NonNullable<V[K]>> = []): RadioList<NonNullable<V[K]>> {
    return this.addControl(name, new RadioList<NonNullable<V[K]>>(label, items));
  }

  addCheckboxList<K extends ListKeys<V>>(name: K, label = '', items: Items<ItemOf<V[K]>> = []): CheckboxList<ItemOf<V[K]>> {
    return this.addControl(name, new CheckboxList<ItemOf<V[K]>>(label, items));
  }

  /** A select with a search field, see DropDownList. Items are fixed, or come from `search`. */
  addDropDownList<K extends keyof V & string>(
    name: K, label = '', options: DropDownListOptions<NonNullable<V[K]>> = {},
  ): DropDownList<NonNullable<V[K]>> {
    return this.addControl(name, new DropDownList<NonNullable<V[K]>>(label, options));
  }

  /**
   * A text field with suggestions, see ComboBox. The value is a picked item. `allowCustom` lets a typed text
   * be the value too, so it is allowed only for fields that can hold a text.
   */
  addComboBox<K extends keyof V & string>(
    name: K, label = '',
    options: ComboBoxOptions<NonNullable<V[K]>> & { allowCustom?: string extends V[K] ? boolean : false } = {},
  ): ComboBox<NonNullable<V[K]>> {
    return this.addControl(name, new ComboBox<NonNullable<V[K]>>(label, options));
  }

  /**
   * Several values as tags, see TagInput. The field must be a list. `allowNew` makes tags of typed text,
   * so it is allowed only for lists that can hold texts.
   */
  addTagInput<K extends ListKeys<V>>(
    name: K, label = '',
    options: TagInputOptions<ItemOf<V[K]>> & { allowNew?: string extends ItemOf<V[K]> ? boolean : false } = {},
  ): TagInput<ItemOf<V[K]>> {
    return this.addControl(name, new TagInput<ItemOf<V[K]>>(label, options));
  }

  /** One file, File or null. Nothing is uploaded: onSuccess gets the File and sends it the way it needs. */
  addUpload(name: KeysFor<V, File | null>, label = ''): UploadControl<File | null> {
    return this.addControl(name, new UploadControl<File | null>(label));
  }

  /** Several files, File[]. The number of them is checked by Form.MinLength and Form.MaxLength, as in Nette. */
  addMultiUpload(name: KeysFor<V, File[]>, label = ''): UploadControl<File[]> {
    return this.addControl(name, new UploadControl<File[]>(label, true));
  }

  /** One node of a tree, its id or null. Nodes come at once (`nodes`) or level by level (`load`). */
  addTreeSelect<K extends keyof V & string>(
    name: K, label = '', options: TreeSelectOptions<NonNullable<V[K]> & TreeKey> = {},
  ): TreeSelect<NonNullable<V[K]> & TreeKey, (NonNullable<V[K]> & TreeKey) | null> {
    return this.addControl(name, new TreeSelect<NonNullable<V[K]> & TreeKey, (NonNullable<V[K]> & TreeKey) | null>(label, options));
  }

  /**
   * One node of a tree in a drop-down: closed it shows the way to the picked node, open the tree.
   * A lazy tree needs `path`, so the way to a node set from code can be loaded.
   */
  addDropDownTreeSelect<K extends keyof V & string>(
    name: K, label = '', options: DropDownTreeSelectOptions<NonNullable<V[K]> & TreeKey> = {},
  ): DropDownTreeSelect<NonNullable<V[K]> & TreeKey> {
    return this.addControl(name, new DropDownTreeSelect<NonNullable<V[K]> & TreeKey>(label, options));
  }

  /** Several nodes of a tree, a list of ids. */
  addTreeMultiSelect<K extends ListKeys<V>>(
    name: K, label = '', options: TreeSelectOptions<ItemOf<V[K]> & TreeKey> = {},
  ): TreeSelect<ItemOf<V[K]> & TreeKey, (ItemOf<V[K]> & TreeKey)[]> {
    return this.addControl(name, new TreeSelect<ItemOf<V[K]> & TreeKey, (ItemOf<V[K]> & TreeKey)[]>(label, options, true));
  }

  addHidden(name: KeysFor<V, string>, value = ''): HiddenField {
    const control = this.addControl(name, new HiddenField());
    control.setValue(value);
    return control;
  }

  /** A button is not among the values. Several buttons can be told apart by isSubmittedBy(). */
  addSubmit(name: string, caption = ''): SubmitButton {
    return this.addControl(name, new SubmitButton(caption));
  }

  get<K extends keyof V & string>(name: K): FormControl<V[K]> {
    const member = this.members.get(name);
    if (!(member instanceof FormControl)) throw new Error(`The form has no control '${name}'.`);
    return member;
  }

  getContainer<K extends ObjectKeys<V>>(name: K): Container<NonNullable<V[K]>> {
    const member = this.members.get(name);
    if (!(member instanceof Container)) throw new Error(`The form has no container '${name}'.`);
    return member;
  }

  getMultiplier<K extends RowListKeys<V>>(name: K): Multiplier<ItemOf<V[K]> & object> {
    const member = this.members.get(name);
    if (!(member instanceof Multiplier)) throw new Error(`The form has no multiplier '${name}'.`);
    return member;
  }

  /** Values of the container, without disabled and omitted controls. Reads state, so a template follows it. */
  getValues(): V {
    const values: Record<string, unknown> = {};
    for (const [name, member] of this.members) {
      if (member instanceof FormControl) {
        if (!member.omitted && !member.disabled()) values[name] = member.getValue();
      } else {
        values[name] = member.getValues();
      }
    }
    return values as V;
  }

  /** Fills the controls, also nested containers and rows, typically with data loaded from the server. */
  setValues(values: DeepPartial<V>): this {
    batch(() => {
      for (const [name, value] of Object.entries(values)) {
        const member = this.members.get(name);
        if (value === undefined || !member) continue;
        if (member instanceof FormControl) member.setValue(value);
        else member.setValues(value as never);
      }
    });
    return this;
  }

  /** Checks all controls inside, also nested. Returns whether they are valid. */
  validateAll(): boolean {
    let valid = true;
    batch(() => {
      for (const member of this.members.values()) {
        valid = (member instanceof FormControl ? member.validate() : member.validateAll()) && valid;
      }
    });
    return valid;
  }

  hasErrors(): boolean {
    return [...this.members.values()].some(member => member.hasErrors());
  }

  /** Empties all controls inside and their errors. */
  reset(): void {
    batch(() => {
      for (const member of this.members.values()) {
        if (member instanceof FormControl) {
          member.setValue((Array.isArray(member.getValue()) ? [] : member instanceof Checkbox ? false : null) as never);
          member.cleanErrors();
        } else {
          member.reset();
        }
      }
    });
  }

  /** Finds what a path from the server leads to, e.g. ['customer', 'city'] or ['lines', '2', 'quantity']. */
  resolve(path: string[]): Member | null {
    const [first, ...rest] = path;
    const member = first === undefined ? undefined : this.members.get(first);
    if (!member) return null;
    if (rest.length === 0) return member;
    return member instanceof FormControl ? null : member.resolve(rest);
  }

  /** Focuses the first control with an error. Returns whether there was one. */
  focusFirstError(): boolean {
    for (const member of this.members.values()) {
      if (member instanceof FormControl) {
        if (member.hasErrors()) {
          member.element?.focus();
          return true;
        }
      } else if (member.focusFirstError()) {
        return true;
      }
    }
    return false;
  }

  /** Visibility of elements switched by toggle() in rules of the controls inside. */
  collectToggles(into: Map<string, boolean>): void {
    for (const member of this.members.values()) {
      if (member instanceof FormControl) member.rules.collectToggles(into);
      else member.collectToggles(into);
    }
  }

  private checkName(name: string): void {
    if (this.members.has(name) || this.form.buttons.has(name)) throw new Error(`The form already has a control '${name}'.`);
  }
}
