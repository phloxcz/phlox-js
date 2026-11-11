/** Validation rules and conditions, like Nette\Forms\Rules. */

import type { FormControl } from './controls';

/** Checks a control. `arg` is what was passed to addRule(), e.g. the length for MinLength. */
export type Validator = (control: FormControl<any>, arg?: any) => boolean;

interface Rule {
  validator: Validator;
  arg: unknown;
  message: string | null;
}

interface Condition {
  control: FormControl<any>;
  validator: Validator;
  arg: unknown;
  branch: Rules;
  otherwise: Rules | null;
}

/** Value of an argument: another control stands for its value, as in Form::Equal with $form['password']. */
function resolve(arg: unknown): unknown {
  return arg && typeof arg === 'object' && 'getValue' in arg ? (arg as FormControl<any>).getValue() : arg;
}

const list = (arg: unknown): unknown[] => (Array.isArray(arg) ? arg : [arg]).map(resolve);

/** What the user typed, also for a number field whose text is not a number yet. */
function text(control: FormControl<any>): string {
  if ('getRawValue' in control) return (control as unknown as { getRawValue(): string }).getRawValue();
  const value = control.getValue();
  return value === null || value === undefined ? '' : String(value);
}

function length(control: FormControl<any>): number {
  const value = control.getValue();
  return Array.isArray(value) ? value.length : text(control).length;
}

function compare(value: unknown, limit: unknown): number {
  if (typeof value === 'number' && typeof limit === 'number') return value - limit;
  return String(value) < String(limit) ? -1 : String(value) > String(limit) ? 1 : 0;
}

const inRange = (value: number, [min, max]: [number | null, number | null]): boolean =>
  (min === null || value >= min) && (max === null || value <= max);

function validUrl(value: string): boolean {
  try {
    const url = new URL(/^[a-z][\w+.-]*:\/\//i.test(value) ? value : `http://${value}`);
    return /^https?:$/.test(url.protocol) && url.hostname.includes('.');
  } catch {
    return false;
  }
}

/** The validators, also available as Form.Filled, Form.Email and so on. */
export const validators = {
  Filled: (control => control.isFilled()) as Validator,
  Blank: (control => !control.isFilled()) as Validator,
  Equal: ((control, arg) => list(arg).some(value => Object.is(value, control.getValue()) || String(value) === text(control))) as Validator,
  NotEqual: ((control, arg) => !list(arg).some(value => Object.is(value, control.getValue()) || String(value) === text(control))) as Validator,
  MinLength: ((control, arg) => length(control) >= Number(resolve(arg))) as Validator,
  MaxLength: ((control, arg) => length(control) <= Number(resolve(arg))) as Validator,
  Length: ((control, arg) => inRange(length(control), (Array.isArray(arg) ? arg : [arg, arg]) as [number, number])) as Validator,
  Email: (control => /^[^\s@]+@[^\s@]+\.[^\s@.]+$/.test(text(control))) as Validator,
  URL: (control => validUrl(text(control))) as Validator,
  Pattern: ((control, arg) => new RegExp(`^(?:${String(arg)})$`, 'u').test(text(control))) as Validator,
  Integer: (control => /^-?\d+$/.test(text(control).trim())) as Validator,
  Float: (control => /^-?(\d+([.,]\d*)?|[.,]\d+)$/.test(text(control).trim())) as Validator,
  Min: ((control, arg) => compare(control.getValue(), resolve(arg)) >= 0) as Validator,
  Max: ((control, arg) => compare(control.getValue(), resolve(arg)) <= 0) as Validator,
  Range: ((control, arg) => {
    const [min, max] = (arg as unknown[]).map(resolve);
    return (min === null || min === undefined || compare(control.getValue(), min) >= 0)
      && (max === null || max === undefined || compare(control.getValue(), max) <= 0);
  }) as Validator,
  IsIn: ((control, arg) => list(arg).includes(control.getValue())) as Validator,
};

/** These are checked even when the control is empty. All other rules apply only to a filled control, as in Nette. */
const CHECKS_EMPTY = new Set<Validator>([validators.Filled, validators.Blank]);

/** Messages used when addRule() gets none. Replace them for the language of the application. */
export const messages = new Map<Validator, string>([
  [validators.Filled, 'This field is required.'],
  [validators.Blank, 'This field should be blank.'],
  [validators.Equal, 'Please enter %s.'],
  [validators.NotEqual, 'This value should not be %s.'],
  [validators.MinLength, 'Please enter at least %d characters.'],
  [validators.MaxLength, 'Please enter no more than %d characters.'],
  [validators.Length, 'Please enter a value between %d and %d characters long.'],
  [validators.Email, 'Please enter a valid email address.'],
  [validators.URL, 'Please enter a valid URL.'],
  [validators.Pattern, 'Please enter a value in the required format.'],
  [validators.Integer, 'Please enter a valid integer.'],
  [validators.Float, 'Please enter a valid number.'],
  [validators.Min, 'Please enter a value greater than or equal to %d.'],
  [validators.Max, 'Please enter a value less than or equal to %d.'],
  [validators.Range, 'Please enter a value between %d and %d.'],
  [validators.IsIn, 'Please submit one of the allowed values.'],
]);

/** %label, %name and %value, then %d and %s in order of the arguments. */
function format(message: string, control: FormControl<any>, arg: unknown): string {
  const args = arg === undefined ? [] : list(arg);
  let next = 0;
  return message
    .replaceAll('%label', control.label.replace(/:\s*$/, ''))
    .replaceAll('%name', control.name)
    .replaceAll('%value', text(control))
    .replace(/%[ds]/g, placeholder => (next < args.length ? String(args[next++]) : placeholder));
}

export class Rules {
  private items: (Rule | Condition)[] = [];
  private toggles = new Map<string, boolean>();
  /** The condition this set of rules belongs to, for elseCondition(). */
  private owner: Condition | null = null;

  constructor(private control: FormControl<any>, private parent: Rules | null = null) {}

  addRule(validator: Validator, message: string | null = null, arg?: unknown): this {
    this.items.push({ validator, arg, message });
    return this;
  }

  /** Rules added after this apply only when the condition holds, until endCondition(). */
  addCondition(validator: Validator, arg?: unknown): Rules {
    return this.addConditionOn(this.control, validator, arg);
  }

  /** The same as addCondition(), but the condition checks another control. */
  addConditionOn(control: FormControl<any>, validator: Validator, arg?: unknown): Rules {
    const branch = new Rules(this.control, this);
    const condition: Condition = { control, validator, arg, branch, otherwise: null };
    branch.owner = condition;
    this.items.push(condition);
    return branch;
  }

  /** Rules for when the condition does not hold. */
  elseCondition(): Rules {
    if (!this.owner || !this.parent) throw new Error('elseCondition() must follow addCondition().');
    this.owner.otherwise ??= new Rules(this.control, this.parent);
    return this.owner.otherwise;
  }

  endCondition(): Rules {
    if (!this.parent) throw new Error('endCondition() must follow addCondition().');
    return this.parent;
  }

  /** Shows the element with the id while the condition holds, hides it otherwise. With false the other way round. */
  toggle(id: string, show = true): this {
    this.toggles.set(id, show);
    return this;
  }

  /** Makes the control required, or not. In a condition it is required only while the condition holds. */
  setRequired(message: string | boolean = true): this {
    this.items = this.items.filter(item => !('message' in item) || item.validator !== validators.Filled);
    if (message !== false) this.items.unshift({ validator: validators.Filled, arg: undefined, message: message === true ? null : message });
    return this;
  }

  isRequired(): boolean {
    return this.items.some(item => 'message' in item && item.validator === validators.Filled);
  }

  /** Returns the first error, as Nette stops at the first rule that fails. */
  validate(): string | null {
    for (const item of this.items) {
      if ('branch' in item) {
        const holds = item.validator(item.control, item.arg);
        const error = (holds ? item.branch : item.otherwise)?.validate() ?? null;
        if (error) return error;
        continue;
      }
      if (!CHECKS_EMPTY.has(item.validator) && !this.control.isFilled()) continue;
      if (!item.validator(this.control, item.arg)) {
        return format(item.message ?? messages.get(item.validator) ?? 'Please enter a valid value.', this.control, item.arg);
      }
    }
    return null;
  }

  /** Visibility of toggled elements: shown when any rule says so. */
  collectToggles(into: Map<string, boolean>, active = true): void {
    for (const [id, show] of this.toggles) into.set(id, (into.get(id) ?? false) || (active ? show : !show));
    for (const item of this.items) {
      if (!('branch' in item)) continue;
      const holds = item.validator(item.control, item.arg);
      item.branch.collectToggles(into, active && holds);
      item.otherwise?.collectToggles(into, active && !holds);
    }
  }
}
