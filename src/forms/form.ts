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

/** Equal values: primitives, plain objects and arrays by content, anything else (a File) by identity. */
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((item, i) => same(item, b[i]));
  if (!isPlain(a) || !isPlain(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => same(a[key], b[key]));
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

/** A copy of plain objects and arrays, so later changes of the values do not change it. */
function copy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copy) as T;
  if (isPlain(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)])) as T;
  return value;
}

export class Form<V extends object = Record<string, any>> extends Container<V> {
  public static Filled = validators.Filled;
  public static Required = validators.Filled;
  public static Blank = validators.Blank;
  public static Equal = validators.Equal;
  public static NotEqual = validators.NotEqual;
  public static MinLength = validators.MinLength;
  public static MaxLength = validators.MaxLength;
  public static Length = validators.Length;
  public static Email = validators.Email;
  public static URL = validators.URL;
  public static Pattern = validators.Pattern;
  public static Integer = validators.Integer;
  public static Numeric = validators.Integer;
  public static Float = validators.Float;
  public static Min = validators.Min;
  public static Max = validators.Max;
  public static Range = validators.Range;
  public static IsIn = validators.IsIn;
  public static MaxFileSize = validators.MaxFileSize;
  public static MimeType = validators.MimeType;
  public static Image = validators.Image;
  /** Default messages of the rules, keyed by the validator: Form.messages.set(Form.Filled, 'Vyplňte.'). */
  public static messages = messages;

  public readonly id = `frm${++lastId}`;
  /** Submit buttons of the whole form, also those added to containers. */
  public readonly buttons = new Map<string, SubmitButton>();
  /** Errors of the whole form, not of one control. */
  public readonly errors = state<string[]>([]);
  /** The values the form was filled with or last saved, see isChanged(). */
  private saved = state<V | null>(null);

  /**
   * True when the values differ from the saved ones: those from setDefaults(), after a successful submit,
   * after reset(), or those the form had when it was first rendered. For Component.hasUnsavedChanges().
   */
  public readonly isChanged: Accessor<boolean> = computed(() => {
    const saved = this.saved();
    return saved !== null && !same(this.getValues(), saved);
  });

  /** True while onSuccess runs. Submit buttons are disabled meanwhile. */
  public readonly submitting = state(false);

  /** Called with the values when the form is sent and valid. An RpcError with invalid fields is shown at the fields. */
  public onSuccess: ((values: V, form: this) => void | Promise<void>) | null = null;
  /** Called when the form is sent but not valid. */
  public onError: ((form: this) => void) | null = null;

  public submittedBy: SubmitButton | null = null;
  /** The button the user clicked, set by the button. */
  public clickedButton: SubmitButton | null = null;
  public element: HTMLFormElement | null = null;

  /** Elements switched by toggle() in rules: id → visible. */
  public readonly toggles: Accessor<Map<string, boolean>> = computed(() => {
    const result = new Map<string, boolean>();
    this.collectToggles(result);
    return result;
  });

  public override get form(): Form<any> {
    return this;
  }

  public override get idPrefix(): string {
    return this.id;
  }

  public override htmlName(name: string): string {
    return name;
  }

  public getButton(name: string): SubmitButton {
    const button = this.buttons.get(name);
    if (!button) throw new Error(`The form has no button '${name}'.`);
    return button;
  }

  /** Fills the controls, typically with data loaded from the server. The same as setValues(). */
  public setDefaults(values: DeepPartial<V>): this {
    // One batch: an effect watching isChanged() (autosave) must never see the defaults as a change
    batch(() => {
      this.setValues(values);
      this.markSaved();
    });
    return this;
  }

  /** The current values are the saved ones, isChanged() is false. For saving outside onSuccess. */
  public markSaved(): void {
    this.saved.set(copy(untrack(() => this.getValues())));
  }

  /** @internal The first rendering remembers the values unless something has been saved before. */
  public markRendered(): void {
    if (untrack(this.saved) === null) this.markSaved();
  }

  /** Checks the given controls, or the whole form. Returns whether they are valid. */
  public validate(controls?: Iterable<FormControl<any>>): boolean {
    this.errors.set([]);
    if (!controls) return this.validateAll();
    let valid = true;
    batch(() => {
      for (const control of controls) valid = control.validate() && valid;
    });
    return valid;
  }

  public override hasErrors(): boolean {
    return this.errors().length > 0 || super.hasErrors();
  }

  public addError(message: string): void {
    this.errors.update(errors => [...errors, message]);
  }

  /**
   * Shows errors of invalid parameters from the server at the controls. Paths such as `input.name`
   * lead to the control `name`, `input.lines.2.quantity` to the quantity in the third row.
   * A path with no control becomes an error of the form. Returns whether the error had such fields.
   */
  public addServerErrors(error: unknown, prefix?: string): boolean {
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
  public async submit(button: SubmitButton | null = null): Promise<boolean> {
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
      this.markSaved();
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
  public override reset(): void {
    batch(() => {
      super.reset();
      this.errors.set([]);
      this.markSaved();
    });
  }
}

export type { Validator };
