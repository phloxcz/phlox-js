/** Form controls, like Nette\Forms\Controls. Each holds its value in state, so templates follow it. */

import { For } from '../ui/flow';
import { state, untrack } from '../reactive/reactive';
import type { State } from '../reactive/reactive';
import type { Child } from '../ui/dom';
import { classes, currentTheme } from '../ui/theme';
import { Rules } from './rules';
import type { Validator } from './rules';
import type { Form } from './form';
import type { Container } from './container';

/** Attributes passed on by <Input control={...} class="wide" />. */
export type ExtraAttributes = Record<string, unknown>;

/**
 * Choices of a select or a list: pairs of value and label, values that are their own labels,
 * or an object whose integer-like keys become numbers.
 */
export type Items<T> = readonly (readonly [T, string])[] | readonly T[] | Record<string, string>;

/** Items as pairs of value and label. */
export function toPairs<T>(items: Items<T>): [T, string][] {
  if (Array.isArray(items)) {
    return items.map(item => (Array.isArray(item) ? [item[0] as T, String(item[1])] : [item as T, String(item)]));
  }
  return Object.entries(items).map(([key, label]) => [(/^-?\d+$/.test(key) ? Number(key) : key) as T, label]);
}

export abstract class FormControl<T = unknown> {
  /** Set by the form when the control is added. */
  form!: Form<any>;
  /** The form or a nested container the control is in. */
  container!: Container<any>;
  name = '';
  readonly errors = state<string[]>([]);
  readonly disabled = state(false);
  readonly rules: Rules;
  /** Left out of getValues(). Buttons are omitted, other controls can be by setOmitted(). */
  omitted = false;
  /** The element the user works with, for focus after a failed validation. */
  element: HTMLElement | null = null;
  /** The label is part of the input itself, e.g. a checkbox. */
  readonly labelInInput: boolean = false;
  /** The user has left the field after changing it: from now on the rules are checked while typing. */
  private touched = false;
  /** The user has changed the value, or opened its list. Leaving a field nobody has worked with checks nothing. */
  protected edited = false;

  /**
   * The value as a state, like a binding in MVVM. Given to a template without calling it, the text follows
   * typing: <h2>{control.value}</h2>. control.value() reads it, control.value.set(x) writes it to the field,
   * the same as getValue() and setValue().
   */
  readonly value: State<T> = Object.assign(() => this.getValue(), {
    set: (value: T) => this.setValue(value),
    update: (change: (value: T) => T) => this.setValue(change(untrack(() => this.getValue()))),
  });

  constructor(public label = '') {
    this.rules = new Rules(this);
  }

  get htmlId(): string {
    return `${this.container.idPrefix}-${this.name}`;
  }

  /** The name attribute, like customer[city] in Nette for a control in a container. */
  get htmlName(): string {
    return this.container.htmlName(this.name);
  }

  abstract getValue(): T;
  abstract setValue(value: T): void;
  abstract isFilled(): boolean;

  /** Renders the control, used by <Input>. */
  abstract render(attributes: ExtraAttributes): Child;

  setRequired(message: string | boolean = true): this {
    this.rules.setRequired(message);
    return this;
  }

  isRequired(): boolean {
    return this.rules.isRequired();
  }

  addRule(validator: Validator, message: string | null = null, arg?: unknown): this {
    this.rules.addRule(validator, message, arg);
    return this;
  }

  addCondition(validator: Validator, arg?: unknown): Rules {
    return this.rules.addCondition(validator, arg);
  }

  addConditionOn(control: FormControl<any>, validator: Validator, arg?: unknown): Rules {
    return this.rules.addConditionOn(control, validator, arg);
  }

  setDisabled(disabled = true): this {
    this.disabled.set(disabled);
    return this;
  }

  setOmitted(omitted = true): this {
    this.omitted = omitted;
    return this;
  }

  addError(message: string): void {
    this.errors.update(errors => [...errors, message]);
  }

  hasErrors(): boolean {
    return this.errors().length > 0;
  }

  cleanErrors(): void {
    this.errors.set([]);
  }

  /** As if the user had not worked with the control yet: no errors, leaving it checks nothing. Used by reset(). */
  pristine(): void {
    this.touched = false;
    this.edited = false;
    this.errors.set([]);
  }

  /** Checks the rules. A disabled control is not checked, as in Nette. */
  validate(): boolean {
    const error = this.disabled() ? null : this.rules.validate();
    this.errors.set(error ? [error] : []);
    return !error;
  }

  /** Attributes for an own element, like n:name in Latte: <input {...control.attrs()} class="x" />. */
  attrs(): Record<string, unknown> {
    return {
      id: this.htmlId,
      name: this.htmlName,
      required: this.isRequired(),
      disabled: this.disabled,
      'aria-invalid': () => (this.hasErrors() ? 'true' : null),
      'aria-describedby': () => (this.hasErrors() ? `${this.htmlId}-error` : null),
      ref: (element: HTMLElement) => {
        this.element = element;
      },
      onBlur: (event?: FocusEvent) => {
        // Tabbing through an empty required field must not shout at the user, the form checks it when sent
        if (!this.edited && !this.hasErrors()) return;
        this.touched = true;
        // Not when the focus goes to a button: the error would move it away under the mouse and the click
        // would be lost. Sending validates anyway, other buttons let the field be checked on the next blur.
        if (event?.relatedTarget instanceof HTMLButtonElement) return;
        this.validate();
      },
    };
  }

  /**
   * Classes of a rendered element: those of the theme slot, the `invalid` class while there is an error,
   * and the class passed to <Input>. Call it while rendering, the theme is the one of the running application.
   */
  protected classFor(attributes: ExtraAttributes, slot: string): () => string {
    const theme = currentTheme();
    const own = attributes.class;
    return () => classes(
      theme.class(slot),
      this.hasErrors() && theme.class('invalid'),
      typeof own === 'function' ? (own as () => string)() : (own as string | undefined),
    );
  }

  /** After a change: once there is an error or the user has left the field, the rules are checked live. */
  protected changed(): void {
    this.edited = true;
    if (this.touched || this.hasErrors()) this.validate();
  }
}

type TextKind = 'text' | 'integer' | 'float' | 'date';

/** Text field. With addInteger() and addFloat() its value is a number, with addDate() a text YYYY-MM-DD. */
export class TextInput<T = string> extends FormControl<T> {
  readonly raw = state('');
  private nullable = false;
  htmlType = 'text';

  constructor(label = '', private kind: TextKind = 'text') {
    super(label);
    if (kind === 'integer' || kind === 'float') this.htmlType = 'number';
    if (kind === 'date') this.htmlType = 'date';
  }

  /** An empty field gives null instead of ''. Number and date fields are nullable always. */
  setNullable(nullable = true): this {
    this.nullable = nullable;
    return this;
  }

  setHtmlType(type: string): this {
    this.htmlType = type;
    return this;
  }

  getRawValue(): string {
    return this.raw();
  }

  getValue(): T {
    const raw = this.raw().trim();
    if (this.kind === 'text') return (raw === '' && this.nullable ? null : this.raw()) as T;
    if (raw === '') return null as T;
    if (this.kind === 'date') return raw as T;
    const number = Number(raw.replace(',', '.'));
    return (Number.isNaN(number) ? null : number) as T;
  }

  setValue(value: T): void {
    this.raw.set(value === null || value === undefined ? '' : String(value));
  }

  isFilled(): boolean {
    return this.raw().trim() !== '';
  }

  override attrs(): Record<string, unknown> {
    return {
      ...super.attrs(),
      value: this.raw,
      onInput: (event: Event) => {
        this.raw.set((event.currentTarget as HTMLInputElement).value);
        this.changed();
      },
    };
  }

  render(attributes: ExtraAttributes): Child {
    return <input type={this.htmlType} {...attributes} {...this.attrs()} class={this.classFor(attributes, 'input')} />;
  }
}

export class TextArea extends TextInput<string> {
  override render(attributes: ExtraAttributes): Child {
    return <textarea {...attributes} {...this.attrs()} class={this.classFor(attributes, 'textarea')} />;
  }
}

export class Checkbox extends FormControl<boolean> {
  readonly checked = state(false);
  override readonly labelInInput = true;

  getValue(): boolean {
    return this.checked();
  }

  setValue(value: boolean): void {
    this.checked.set(Boolean(value));
  }

  isFilled(): boolean {
    return this.checked();
  }

  override attrs(): Record<string, unknown> {
    return {
      ...super.attrs(),
      checked: this.checked,
      onChange: (event: Event) => {
        this.checked.set((event.currentTarget as HTMLInputElement).checked);
        this.changed();
      },
    };
  }

  /** The checkbox inside its label, as in Nette. */
  render(attributes: ExtraAttributes): Child {
    return (
      <label class={currentTheme().class('checkbox')}>
        <input type="checkbox" {...attributes} {...this.attrs()} class={this.classFor(attributes, 'checkboxInput')} /> {this.label}
      </label>
    );
  }
}

/** Common part of controls with choices. */
abstract class ChoiceControl<T, V> extends FormControl<V> {
  readonly items = state<[T, string][]>([]);

  constructor(label = '', items: Items<T> = []) {
    super(label);
    this.setItems(items);
  }

  /** Choices can be set later, e.g. when they come from the server. */
  setItems(items: Items<T>): this {
    this.items.set(toPairs(items));
    return this;
  }

  protected indexOf(value: T): number {
    return this.items().findIndex(([item]) => Object.is(item, value));
  }
}

export class SelectBox<T = string> extends ChoiceControl<T, T | null> {
  readonly selected = state<T | null>(null);
  private prompt: string | null = null;

  /** The first option without a value, like setPrompt() in Nette. */
  setPrompt(prompt: string | null): this {
    this.prompt = prompt;
    return this;
  }

  getValue(): T | null {
    return this.selected();
  }

  setValue(value: T | null): void {
    this.selected.set(value);
  }

  isFilled(): boolean {
    return this.selected() !== null;
  }

  render(attributes: ExtraAttributes): Child {
    return (
      <select
        {...attributes}
        {...this.attrs()}
        class={this.classFor(attributes, 'select')}
        value={() => {
          const index = this.selected() === null ? -1 : this.indexOf(this.selected() as T);
          return index < 0 ? '' : String(index);
        }}
        onChange={event => {
          const index = event.currentTarget.value;
          this.selected.set(index === '' ? null : this.items()[Number(index)]![0]);
          this.changed();
        }}
      >
        {this.prompt === null ? null : <option value="">{this.prompt}</option>}
        <For each={this.items}>{([, label], index) => <option value={() => String(index())}>{label}</option>}</For>
      </select>
    );
  }
}

export class MultiSelectBox<T = string> extends ChoiceControl<T, T[]> {
  readonly selected = state<T[]>([]);

  getValue(): T[] {
    return this.selected();
  }

  setValue(value: T[]): void {
    this.selected.set([...(value ?? [])]);
  }

  isFilled(): boolean {
    return this.selected().length > 0;
  }

  render(attributes: ExtraAttributes): Child {
    return (
      <select
        multiple
        {...attributes}
        {...this.attrs()}
        class={this.classFor(attributes, 'select')}
        onChange={event => {
          const chosen = [...event.currentTarget.selectedOptions].map(option => this.items()[Number(option.value)]![0]);
          this.selected.set(chosen);
          this.changed();
        }}
      >
        <For each={this.items}>
          {([value, label], index) => (
            <option value={() => String(index())} selected={() => this.selected().includes(value)}>{label}</option>
          )}
        </For>
      </select>
    );
  }
}

export class RadioList<T = string> extends ChoiceControl<T, T | null> {
  readonly selected = state<T | null>(null);

  getValue(): T | null {
    return this.selected();
  }

  setValue(value: T | null): void {
    this.selected.set(value);
  }

  isFilled(): boolean {
    return this.selected() !== null;
  }

  render(attributes: ExtraAttributes): Child {
    const { id, ...common } = this.attrs();
    const theme = currentTheme();
    const inputClass = this.classFor({}, 'choiceInput');
    return (
      <div id={id as string} role="radiogroup" {...attributes} class={classes(theme.class('radioList'), attributes.class as string)}>
        <For each={this.items}>
          {([value, label], index) => (
            <label class={theme.class('choiceItem')}>
              <input
                type="radio"
                {...common}
                class={inputClass}
                id={() => `${this.htmlId}-${index()}`}
                checked={() => Object.is(this.selected(), value)}
                onChange={() => {
                  this.selected.set(value);
                  this.changed();
                }}
              /> {label}
            </label>
          )}
        </For>
      </div>
    );
  }
}

export class CheckboxList<T = string> extends ChoiceControl<T, T[]> {
  readonly selected = state<T[]>([]);

  getValue(): T[] {
    return this.selected();
  }

  setValue(value: T[]): void {
    this.selected.set([...(value ?? [])]);
  }

  isFilled(): boolean {
    return this.selected().length > 0;
  }

  render(attributes: ExtraAttributes): Child {
    const { id, required: _required, ...common } = this.attrs();
    const theme = currentTheme();
    const inputClass = this.classFor({}, 'choiceInput');
    return (
      <div id={id as string} {...attributes} class={classes(theme.class('checkboxList'), attributes.class as string)}>
        <For each={this.items}>
          {([value, label], index) => (
            <label class={theme.class('choiceItem')}>
              <input
                type="checkbox"
                {...common}
                class={inputClass}
                id={() => `${this.htmlId}-${index()}`}
                checked={() => this.selected().includes(value)}
                onChange={event => {
                  const on = event.currentTarget.checked;
                  // Kept in the order of the items
                  this.selected.set(this.items().map(([item]) => item).filter(item =>
                    Object.is(item, value) ? on : this.selected().includes(item)));
                  this.changed();
                }}
              /> {label}
            </label>
          )}
        </For>
      </div>
    );
  }
}

export class HiddenField extends FormControl<string> {
  readonly raw = state('');

  getValue(): string {
    return this.raw();
  }

  setValue(value: string): void {
    this.raw.set(value === null || value === undefined ? '' : String(value));
  }

  isFilled(): boolean {
    return this.raw() !== '';
  }

  render(attributes: ExtraAttributes): Child {
    return <input type="hidden" {...attributes} id={this.htmlId} name={this.htmlName} value={this.raw} />;
  }
}

export class SubmitButton extends FormControl<void> {
  /** Controls validated when the form is sent by this button. An empty list validates nothing, e.g. for Cancel. */
  validationScope: FormControl<any>[] | null = null;

  constructor(public caption = '') {
    super('');
    this.omitted = true;
  }

  setValidationScope(controls: FormControl<any>[] | null): this {
    this.validationScope = controls;
    return this;
  }

  /** Whether the form is being sent by this button, for the handler of onSuccess. */
  isSubmittedBy(): boolean {
    return this.form.submittedBy === this;
  }

  getValue(): void {}
  setValue(): void {}
  isFilled(): boolean {
    return false;
  }

  /** A class passed to <Input> replaces the one of the theme, e.g. class="btn btn-secondary" for Cancel. */
  render(attributes: ExtraAttributes): Child {
    return (
      <button
        type="submit"
        {...attributes}
        class={(attributes.class as string | undefined) ?? currentTheme().class('button')}
        id={this.htmlId}
        name={this.htmlName}
        disabled={() => this.disabled() || this.form.submitting()}
        onClick={() => {
          this.form.clickedButton = this;
        }}
      >
        {this.caption}
      </button>
    );
  }
}
