/**
 * Form, like Nette\Forms\Form. V is the type of its values, usually a DTO generated from PHP.
 * The controls are added by methods of Container, which a form is, as in Nette.
 */

import { batch, computed, state, untrack } from '../reactive/reactive';
import type { Accessor } from '../reactive/reactive';
import { FormControl, SubmitButton } from './controls';
import { Container } from './container';
import { Multiplier } from './multiplier';
import { messages, validators } from './rules';
import type { Validator } from './rules';
import type { DeepPartial } from './container';

let lastId = 0;

export class Form<V extends object = Record<string, any>> extends Container<V> {
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
  /** Submit buttons of the whole form, also those added to containers. */
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
    this.collectToggles(result);
    return result;
  });

  override get form(): Form<any> {
    return this;
  }

  override get idPrefix(): string {
    return this.id;
  }

  override htmlName(name: string): string {
    return name;
  }

  getButton(name: string): SubmitButton {
    const button = this.buttons.get(name);
    if (!button) throw new Error(`The form has no button '${name}'.`);
    return button;
  }

  /** Fills the controls, typically with data loaded from the server. The same as setValues(). */
  setDefaults(values: DeepPartial<V>): this {
    return this.setValues(values);
  }

  /** Checks the given controls, or the whole form. Returns whether they are valid. */
  validate(controls?: Iterable<FormControl<any>>): boolean {
    this.errors.set([]);
    if (!controls) return this.validateAll();
    let valid = true;
    batch(() => {
      for (const control of controls) valid = control.validate() && valid;
    });
    return valid;
  }

  override hasErrors(): boolean {
    return this.errors().length > 0 || super.hasErrors();
  }

  addError(message: string): void {
    this.errors.update(errors => [...errors, message]);
  }

  /**
   * Shows errors of invalid parameters from the server at the controls. Paths such as `input.name`
   * lead to the control `name`, `input.lines.2.quantity` to the quantity in the third row.
   * A path with no control becomes an error of the form. Returns whether the error had such fields.
   */
  addServerErrors(error: unknown, prefix?: string): boolean {
    const source = error as { data?: { fields?: unknown }; fields?: unknown } | null;
    const fields = source?.data?.fields ?? source?.fields;
    if (!fields || typeof fields !== 'object') return false;

    batch(() => {
      for (const [path, message] of Object.entries(fields as Record<string, unknown>)) {
        const relative = prefix && path.startsWith(`${prefix}.`) ? path.slice(prefix.length + 1) : path;
        const segments = relative.split('.');
        // The first part is usually the name of the parameter, e.g. input
        const target = this.resolve(segments) ?? (prefix ? null : this.resolve(segments.slice(1)));
        for (const text of Array.isArray(message) ? message : [message]) {
          if (target instanceof FormControl || target instanceof Multiplier) target.addError(String(text));
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
    if (!this.validate(button?.validationScope ?? undefined)) {
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
  override reset(): void {
    batch(() => {
      super.reset();
      this.errors.set([]);
    });
  }
}

export type { Validator };
