/** Form, like Nette\Forms\Form. V is the type of its values, usually a DTO generated from PHP. */

import { batch, computed, state, untrack } from '../reactive/reactive';
import type { Accessor } from '../reactive/reactive';
import {
  Checkbox, CheckboxList, FormControl, HiddenField, MultiSelectBox, RadioList, SelectBox, SubmitButton, TextArea, TextInput,
} from './controls';
import type { Items } from './controls';
import { DropDownList } from './dropdownlist';
import type { DropDownListOptions } from './dropdownlist';
import { ComboBox } from './combobox';
import type { ComboBoxOptions } from './combobox';
import { TagInput } from './taginput';
import type { TagInputOptions } from './taginput';
import { messages, validators } from './rules';
import type { Validator } from './rules';

/** Names of the values of V that can hold a T: addText() needs a text field of the DTO, addInteger() a number. */
type KeysFor<V, T> = { [K in keyof V]-?: T extends V[K] ? K : never }[keyof V] & string;
type ListKeys<V> = { [K in keyof V]-?: NonNullable<V[K]> extends readonly unknown[] ? K : never }[keyof V] & string;
type ItemOf<L> = NonNullable<L> extends readonly (infer E)[] ? E : never;

let lastId = 0;

export class Form<V extends object = Record<string, any>> {
  static Filled = validators.Filled;
  static Required = validators.Filled;
  static Blank = validators.Blank;
  static Equal = validators.Equal;
  static NotEqual = validators.NotEqual;
  static MinLength = validators.MinLength;
  static MaxLength = validators.MaxLength;
  static Length = validators.Length;
  static Email = validators.Email;
  static URL = validators.URL;
  static Pattern = validators.Pattern;
  static Integer = validators.Integer;
  static Numeric = validators.Integer;
  static Float = validators.Float;
  static Min = validators.Min;
  static Max = validators.Max;
  static Range = validators.Range;
  static IsIn = validators.IsIn;
  /** Default messages of the rules, keyed by the validator: Form.messages.set(Form.Filled, 'Vyplňte.'). */
  static messages = messages;

  readonly id = `frm${++lastId}`;
  readonly controls = new Map<string, FormControl<any>>();
  readonly buttons = new Map<string, SubmitButton>();
  /** Errors of the whole form, not of one control. */
  readonly errors = state<string[]>([]);
  /** True while onSuccess runs. Submit buttons are disabled meanwhile. */
  readonly submitting = state(false);

  /** Called with the values when the form is sent and valid. An RpcError with invalid fields is shown at the fields. */
  onSuccess: ((values: V, form: this) => void | Promise<void>) | null = null;
  /** Called when the form is sent but not valid. */
  onError: ((form: this) => void) | null = null;

  submittedBy: SubmitButton | null = null;
  /** The button the user clicked, set by the button. */
  clickedButton: SubmitButton | null = null;
  element: HTMLFormElement | null = null;

  /** Elements switched by toggle() in rules: id → visible. */
  readonly toggles: Accessor<Map<string, boolean>> = computed(() => {
    const result = new Map<string, boolean>();
    for (const control of this.controls.values()) control.rules.collectToggles(result);
    return result;
  });

  /** Adds an own control, the way the add*() methods do. */
  addControl<C extends FormControl<any>>(name: string, control: C): C {
    if (this.controls.has(name) || this.buttons.has(name)) throw new Error(`The form already has a control '${name}'.`);
    control.form = this;
    control.name = name;
    if (control instanceof SubmitButton) this.buttons.set(name, control);
    else this.controls.set(name, control);
    return control;
  }

  addText(name: KeysFor<V, string>, label = '', maxLength?: number): TextInput<string> {
    const control = this.addControl(name, new TextInput<string>(label));
    if (maxLength !== undefined) control.addRule(Form.MaxLength, null, maxLength);
    return control;
  }

  addPassword(name: KeysFor<V, string>, label = ''): TextInput<string> {
    return this.addControl(name, new TextInput<string>(label)).setHtmlType('password');
  }

  addEmail(name: KeysFor<V, string>, label = ''): TextInput<string> {
    return this.addControl(name, new TextInput<string>(label)).setHtmlType('email').addRule(Form.Email);
  }

  addTextArea(name: KeysFor<V, string>, label = ''): TextArea {
    return this.addControl(name, new TextArea(label));
  }

  /** A whole number, null when empty. */
  addInteger(name: KeysFor<V, number | null>, label = ''): TextInput<number | null> {
    return this.addControl(name, new TextInput<number | null>(label, 'integer')).addRule(Form.Integer);
  }

  /** A number, also with a decimal comma, null when empty. */
  addFloat(name: KeysFor<V, number | null>, label = ''): TextInput<number | null> {
    return this.addControl(name, new TextInput<number | null>(label, 'float')).addRule(Form.Float);
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
    const control = this.controls.get(name);
    if (!control) throw new Error(`The form has no control '${name}'.`);
    return control;
  }

  getButton(name: string): SubmitButton {
    const button = this.buttons.get(name);
    if (!button) throw new Error(`The form has no button '${name}'.`);
    return button;
  }

  /** Values of the controls, without disabled and omitted ones. Reads state, so a template follows it. */
  getValues(): V {
    const values: Record<string, unknown> = {};
    for (const [name, control] of this.controls) {
      if (!control.omitted && !control.disabled()) values[name] = control.getValue();
    }
    return values as V;
  }

  /** Fills the controls, typically with data loaded from the server. */
  setDefaults(values: Partial<V>): this {
    batch(() => {
      for (const [name, value] of Object.entries(values)) {
        if (value !== undefined) this.controls.get(name)?.setValue(value);
      }
    });
    return this;
  }

  /** Checks the given controls, or all of them. Returns whether they are valid. */
  validate(controls: Iterable<FormControl<any>> = this.controls.values()): boolean {
    this.errors.set([]);
    let valid = true;
    batch(() => {
      for (const control of controls) valid = control.validate() && valid;
    });
    return valid;
  }

  hasErrors(): boolean {
    return this.errors().length > 0 || [...this.controls.values()].some(control => control.hasErrors());
  }

  addError(message: string): void {
    this.errors.update(errors => [...errors, message]);
  }

  /**
   * Shows errors of invalid parameters from the server at the controls. Paths such as `input.name`
   * lead to the control `name`. A path with no control becomes an error of the form.
   * Returns whether the error had such fields.
   */
  addServerErrors(error: unknown, prefix?: string): boolean {
    const source = error as { data?: { fields?: unknown }; fields?: unknown } | null;
    const fields = source?.data?.fields ?? source?.fields;
    if (!fields || typeof fields !== 'object') return false;

    batch(() => {
      for (const [path, message] of Object.entries(fields as Record<string, unknown>)) {
        let name = prefix && path.startsWith(`${prefix}.`) ? path.slice(prefix.length + 1) : path;
        if (!this.controls.has(name) && !prefix && name.includes('.')) name = name.slice(name.indexOf('.') + 1);
        const control = this.controls.get(name);
        for (const text of Array.isArray(message) ? message : [message]) {
          if (control) control.addError(String(text));
          else this.addError(`${path}: ${String(text)}`);
        }
      }
    });
    this.focusFirstError();
    return true;
  }

  /**
   * Validates and calls onSuccess, as when the user sends the form.
   * Returns whether it went through. An error thrown by onSuccess is thrown on,
   * except invalid parameters from the server, which are shown at the controls.
   */
  async submit(button: SubmitButton | null = null): Promise<boolean> {
    if (untrack(this.submitting)) return false;
    this.submittedBy = button;
    const scope = button?.validationScope ?? this.controls.values();
    if (!this.validate(scope)) {
      this.focusFirstError();
      this.onError?.(this);
      return false;
    }
    this.submitting.set(true);
    try {
      await this.onSuccess?.(untrack(() => this.getValues()), this);
      return true;
    } catch (error) {
      if (this.addServerErrors(error)) return false;
      throw error;
    } finally {
      this.submitting.set(false);
      this.submittedBy = null;
    }
  }

  /** Empties all controls and errors. */
  reset(): void {
    batch(() => {
      for (const control of this.controls.values()) {
        control.setValue((Array.isArray(control.getValue()) ? [] : control instanceof Checkbox ? false : null) as never);
        control.cleanErrors();
      }
      this.errors.set([]);
    });
  }

  private focusFirstError(): void {
    for (const control of this.controls.values()) {
      if (control.hasErrors()) {
        control.element?.focus();
        return;
      }
    }
  }
}

export type { Validator };
