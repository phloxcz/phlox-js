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
  public form!: Form<any>;
  /** The form or a nested container the control is in. */
  public container!: Container<any>;
  public name = '';
  public readonly errors = state<string[]>([]);
  public readonly disabled = state(false);
  /** Shown as usual but the user cannot change it; unlike disabled it stays in the values, see setReadOnly(). */
  public readonly readOnly = state(false);
  public readonly rules: Rules;
  /** Left out of getValues(). Buttons are omitted, other controls can be by setOmitted(). */
  public omitted = false;
  /** The element the user works with, for focus after a failed validation. */
  public element: HTMLElement | null = null;
  /** The label is part of the input itself, e.g. a checkbox. */
  public readonly labelInInput: boolean = false;
  /** The user has left the field after changing it: from now on the rules are checked while typing. */
  private touched = false;
  /** The user has changed the value, or opened its list. Leaving a field nobody has worked with checks nothing. */
  protected edited = false;

  /**
   * The value as a state, like a binding in MVVM. Given to a template without calling it, the text follows
   * typing: <h2>{control.value}</h2>. control.value() reads it, control.value.set(x) writes it to the field,
   * the same as getValue() and setValue().
   */
  public readonly value: State<T> = Object.assign(() => this.getValue(), {
    set: (value: T) => this.setValue(value),
    update: (change: (value: T) => T) => this.setValue(change(untrack(() => this.getValue()))),
  });

  public constructor(public label = '') {
    this.rules = new Rules(this);
  }

  public get htmlId(): string {
    return `${this.container.idPrefix}-${this.name}`;
  }

  /** The name attribute, like customer[city] in Nette for a control in a container. */
  public get htmlName(): string {
    return this.container.htmlName(this.name);
  }

  public abstract getValue(): T;
  public abstract setValue(value: T): void;
  public abstract isFilled(): boolean;

  /** Renders the control, used by <Input>. */
  public abstract render(attributes: ExtraAttributes): Child;

  public setRequired(message: string | boolean = true): this {
    this.rules.setRequired(message);
    return this;
  }

  public isRequired(): boolean {
    return this.rules.isRequired();
  }

  public addRule(validator: Validator, message: string | null = null, arg?: unknown): this {
    this.rules.addRule(validator, message, arg);
    return this;
  }

  public addCondition(validator: Validator, arg?: unknown): Rules {
    return this.rules.addCondition(validator, arg);
  }

  public addConditionOn(control: FormControl<any>, validator: Validator, arg?: unknown): Rules {
    return this.rules.addConditionOn(control, validator, arg);
  }

  public setDisabled(disabled = true): this {
    this.disabled.set(disabled);
    return this;
  }

  /**
   * Read-only, like readonly in HTML: the value is shown as usual (not greyed out), the user cannot change it,
   * and unlike setDisabled() it stays in the values of the form and is checked by the rules.
   */
  public setReadOnly(readOnly = true): this {
    this.readOnly.set(readOnly);
    return this;
  }

  public setOmitted(omitted = true): this {
    this.omitted = omitted;
    return this;
  }

  public addError(message: string): void {
    this.errors.update(errors => [...errors, message]);
  }

  public hasErrors(): boolean {
    return this.errors().length > 0;
  }

  public cleanErrors(): void {
    this.errors.set([]);
  }

  /** Puts the focus into the control, e.g. after a failed validation or from a button "Write a comment". */
  public focus(): void {
    this.element?.focus();
  }

  /** As if the user had not worked with the control yet: no errors, leaving it checks nothing. Used by reset(). */
  public pristine(): void {
    this.touched = false;
    this.edited = false;
    this.errors.set([]);
  }

  /** Checks the rules. A disabled control is not checked, as in Nette. */
  public validate(): boolean {
    const error = this.disabled() ? null : this.rules.validate();
    this.errors.set(error ? [error] : []);
    return !error;
  }

  /** Attributes for an own element, like n:name in Latte: <input {...control.attrs()} class="x" />. */
  public attrs(): Record<string, unknown> {
    return {
      id: this.htmlId,
      name: this.htmlName,
      required: this.isRequired(),
      disabled: this.disabled,
      'aria-readonly': () => (this.readOnly() ? 'true' : null),
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
  public readonly raw = state('');
  private nullable = false;
  public htmlType = 'text';

  public constructor(label = '', private kind: TextKind = 'text') {
    super(label);
    if (kind === 'integer' || kind === 'float') this.htmlType = 'number';
    if (kind === 'date') this.htmlType = 'date';
  }

  /** An empty field gives null instead of ''. Number and date fields are nullable always. */
  public setNullable(nullable = true): this {
    this.nullable = nullable;
    return this;
  }

  public setHtmlType(type: string): this {
    this.htmlType = type;
    return this;
  }

  public getRawValue(): string {
    return this.raw();
  }

  public getValue(): T {
    const raw = this.raw().trim();
    if (this.kind === 'text') return (raw === '' && this.nullable ? null : this.raw()) as T;
    if (raw === '') return null as T;
    if (this.kind === 'date') return raw as T;
    const number = Number(raw.replace(',', '.'));
    return (Number.isNaN(number) ? null : number) as T;
  }

  public setValue(value: T): void {
    this.raw.set(value === null || value === undefined ? '' : String(value));
  }

  public isFilled(): boolean {
    return this.raw().trim() !== '';
  }

  public override attrs(): Record<string, unknown> {
    return {
      ...super.attrs(),
      readOnly: this.readOnly,
      value: this.raw,
      onInput: (event: Event) => {
        this.raw.set((event.currentTarget as HTMLInputElement).value);
        this.changed();
      },
    };
  }

  public render(attributes: ExtraAttributes): Child {
    return <input type={this.htmlType} {...attributes} {...this.attrs()} class={this.classFor(attributes, 'input')} />;
  }
}

export class TextArea extends TextInput<string> {
  public override render(attributes: ExtraAttributes): Child {
    return <textarea {...attributes} {...this.attrs()} class={this.classFor(attributes, 'textarea')} />;
  }
}

export class Checkbox extends FormControl<boolean> {
  public readonly checked = state(false);
  public override readonly labelInInput = true;

  public getValue(): boolean {
    return this.checked();
  }

  public setValue(value: boolean): void {
    this.checked.set(Boolean(value));
  }

  public isFilled(): boolean {
    return this.checked();
  }

  public override attrs(): Record<string, unknown> {
    return {
      ...super.attrs(),
      checked: this.checked,
      onClick: (event: Event) => blockWhenReadOnly(this, event),
      onChange: (event: Event) => {
        this.checked.set((event.currentTarget as HTMLInputElement).checked);
        this.changed();
      },
    };
  }

  /** The checkbox inside its label, as in Nette. */
  public render(attributes: ExtraAttributes): Child {
    return (
      <label class={currentTheme().class('checkbox')}>
        <input type="checkbox" {...attributes} {...this.attrs()} class={this.classFor(attributes, 'checkboxInput')} /> {this.label}
      </label>
    );
  }
}

/** A read-only checkbox or radio button keeps its state: the click that would change it is cancelled. */
function blockWhenReadOnly(control: FormControl<any>, event: Event): void {
  if (untrack(control.readOnly)) event.preventDefault();
}

/** A read-only select does not open and does not change by the keyboard; Tab still moves on. */
function selectReadOnly(control: FormControl<any>): Record<string, unknown> {
  return {
    onMousedown: (event: Event) => blockWhenReadOnly(control, event),
    onKeydown: (event: KeyboardEvent) => {
      if (event.key !== 'Tab') blockWhenReadOnly(control, event);
    },
  };
}

/** Common part of controls with choices. */
abstract class ChoiceControl<T, V> extends FormControl<V> {
  public readonly items = state<[T, string][]>([]);
  /** Items that are shown but cannot be chosen, see setDisabled(). */
  public readonly disabledItems = state<T[]>([]);

  public constructor(label = '', items: Items<T> = []) {
    super(label);
    this.setItems(items);
  }

  /** Choices can be set later, e.g. when they come from the server. */
  public setItems(items: Items<T>): this {
    this.items.set(toPairs(items));
    return this;
  }

  /** true or false for the whole control, or the values of items that cannot be chosen: setDisabled(['b']), as in Nette. */
  public override setDisabled(disabled: boolean | T[] = true): this {
    if (!Array.isArray(disabled)) return super.setDisabled(disabled);
    this.disabledItems.set([...disabled]);
    return this;
  }

  public isItemDisabled(value: T): boolean {
    return this.disabledItems().some(item => Object.is(item, value));
  }

  protected indexOf(value: T): number {
    return this.items().findIndex(([item]) => Object.is(item, value));
  }
}

export class SelectBox<T = string> extends ChoiceControl<T, T | null> {
  public readonly selected = state<T | null>(null);
  private prompt: string | null = null;

  /** The first option without a value, like setPrompt() in Nette. */
  public setPrompt(prompt: string | null): this {
    this.prompt = prompt;
    return this;
  }

  public getValue(): T | null {
    return this.selected();
  }

  public setValue(value: T | null): void {
    this.selected.set(value);
  }

  public isFilled(): boolean {
    return this.selected() !== null;
  }

  public render(attributes: ExtraAttributes): Child {
    return (
      <select
        {...attributes}
        {...this.attrs()}
        class={this.classFor(attributes, 'select')}
        {...selectReadOnly(this)}
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
        <For each={this.items}>
          {([value, label], index) => <option value={() => String(index())} disabled={() => this.isItemDisabled(value)}>{label}</option>}
        </For>
      </select>
    );
  }
}

export class MultiSelectBox<T = string> extends ChoiceControl<T, T[]> {
  public readonly selected = state<T[]>([]);

  public getValue(): T[] {
    return this.selected();
  }

  public setValue(value: T[]): void {
    this.selected.set([...(value ?? [])]);
  }

  public isFilled(): boolean {
    return this.selected().length > 0;
  }

  public render(attributes: ExtraAttributes): Child {
    return (
      <select
        multiple
        {...attributes}
        {...this.attrs()}
        class={this.classFor(attributes, 'select')}
        {...selectReadOnly(this)}
        onChange={event => {
          const chosen = [...event.currentTarget.selectedOptions].map(option => this.items()[Number(option.value)]![0]);
          this.selected.set(chosen);
          this.changed();
        }}
      >
        <For each={this.items}>
          {([value, label], index) => (
            <option value={() => String(index())} selected={() => this.selected().includes(value)} disabled={() => this.isItemDisabled(value)}>{label}</option>
          )}
        </For>
      </select>
    );
  }
}

export class RadioList<T = string> extends ChoiceControl<T, T | null> {
  public readonly selected = state<T | null>(null);

  public getValue(): T | null {
    return this.selected();
  }

  public setValue(value: T | null): void {
    this.selected.set(value);
  }

  public isFilled(): boolean {
    return this.selected() !== null;
  }

  public render(attributes: ExtraAttributes): Child {
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
                disabled={() => this.disabled() || this.isItemDisabled(value)}
                onClick={event => blockWhenReadOnly(this, event)}
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
  public readonly selected = state<T[]>([]);

  public getValue(): T[] {
    return this.selected();
  }

  public setValue(value: T[]): void {
    this.selected.set([...(value ?? [])]);
  }

  public isFilled(): boolean {
    return this.selected().length > 0;
  }

  public render(attributes: ExtraAttributes): Child {
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
                disabled={() => this.disabled() || this.isItemDisabled(value)}
                onClick={event => blockWhenReadOnly(this, event)}
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
  public readonly raw = state('');

  public getValue(): string {
    return this.raw();
  }

  public setValue(value: string): void {
    this.raw.set(value === null || value === undefined ? '' : String(value));
  }

  public isFilled(): boolean {
    return this.raw() !== '';
  }

  public render(attributes: ExtraAttributes): Child {
    return <input type="hidden" {...attributes} id={this.htmlId} name={this.htmlName} value={this.raw} />;
  }
}

export class SubmitButton extends FormControl<void> {
  /** Controls validated when the form is sent by this button. An empty list validates nothing, e.g. for Cancel. */
  public validationScope: FormControl<any>[] | null = null;

  public constructor(public caption = '') {
    super('');
    this.omitted = true;
  }

  public setValidationScope(controls: FormControl<any>[] | null): this {
    this.validationScope = controls;
    return this;
  }

  /** Whether the form is being sent by this button, for the handler of onSuccess. */
  public isSubmittedBy(): boolean {
    return this.form.submittedBy === this;
  }

  public getValue(): void {}
  public setValue(): void {}
  public isFilled(): boolean {
    return false;
  }

  /** A class passed to <Input> replaces the one of the theme, e.g. class="btn btn-secondary" for Cancel. */
  public render(attributes: ExtraAttributes): Child {
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
