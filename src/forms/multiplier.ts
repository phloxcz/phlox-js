/**
 * Multiplier: rows of controls the user adds, removes and orders, like contributte/forms-multiplier.
 * Every row is a Container made by the factory. The value is the list of the values of the rows, in their order.
 */

import { batch, state, untrack } from '../reactive/reactive';
import { Container } from './container';
import type { DeepPartial, Member, Owner } from './container';
import type { Form } from './form';

export interface MultiplierOptions {
  /** At least this many rows. As many empty rows are there from the start and the last ones cannot be removed. */
  min?: number;
  /** At most this many rows, 0 = no limit. */
  max?: number;
  /** Shown as the legend of the rows by <FormView>. */
  label?: string;
}

let lastRow = 0;

export class Multiplier<R extends object> implements Owner {
  /** Texts of the rows. Replace them for the language of the application. %d is the limit. */
  static texts = {
    add: 'Add',
    remove: 'Remove',
    moveUp: 'Move up',
    moveDown: 'Move down',
    drag: 'Drag to change the order, or use the arrow keys',
    min: 'Please add at least %d rows.',
    max: 'Please add no more than %d rows.',
  };

  /** The rows in their order. */
  readonly rows = state<Container<R>[]>([]);
  /** Errors of the rows as a whole, e.g. too few of them. */
  readonly errors = state<string[]>([]);
  readonly label: string;
  readonly min: number;
  readonly max: number;

  constructor(
    private container: Container<any>,
    readonly name: string,
    private factory: (row: Container<R>) => void,
    options: MultiplierOptions = {},
  ) {
    this.label = options.label ?? '';
    this.min = options.min ?? 0;
    this.max = options.max ?? 0;
    for (let row = 0; row < this.min; row++) this.add();
  }

  get form(): Form<any> {
    return this.container.form;
  }

  get idPrefix(): string {
    return `${this.container.idPrefix}-${this.name}`;
  }

  htmlName(key: string): string {
    return `${this.container.htmlName(this.name)}[${key}]`;
  }

  canAdd(): boolean {
    return this.max === 0 || this.rows().length < this.max;
  }

  canRemove(): boolean {
    return this.rows().length > this.min;
  }

  /** Adds a row at the end, or at the given position. Returns it, or null when the limit is reached. */
  add(values?: DeepPartial<R>, at?: number): Container<R> | null {
    if (!untrack(() => this.canAdd())) return null;
    const row = new Container<R>(this, String(++lastRow));
    this.factory(row);
    if (values) row.setValues(values);
    this.rows.update(rows => {
      const next = [...rows];
      next.splice(at ?? next.length, 0, row);
      return next;
    });
    this.recheck();
    return row;
  }

  /** Removes a row unless it would leave fewer than `min`. Returns whether it was removed. */
  remove(row: Container<R>): boolean {
    if (!untrack(() => this.canRemove())) return false;
    this.rows.update(rows => rows.filter(other => other !== row));
    this.recheck();
    return true;
  }

  /** Moves a row to another position. */
  move(row: Container<R>, to: number): void {
    this.rows.update(rows => {
      const next = rows.filter(other => other !== row);
      next.splice(Math.max(0, Math.min(to, next.length)), 0, row);
      return next;
    });
  }

  getValues(): R[] {
    return this.rows().map(row => row.getValues());
  }

  /** As many rows as values (at least `min`), each filled with its values. */
  setValues(values: DeepPartial<R>[]): void {
    batch(() => {
      const rows = untrack(this.rows).slice(0, values.length);
      while (rows.length < Math.max(values.length, this.min)) {
        const row = new Container<R>(this, String(++lastRow));
        this.factory(row);
        rows.push(row);
      }
      rows.forEach((row, index) => {
        row.reset();
        if (values[index]) row.setValues(values[index]!);
      });
      this.rows.set(rows);
      this.errors.set([]);
    });
  }

  /** Checks the number of rows and every row. */
  validateAll(): boolean {
    const count = untrack(this.rows).length;
    const error = count < this.min
      ? Multiplier.texts.min.replace('%d', String(this.min))
      : this.max > 0 && count > this.max ? Multiplier.texts.max.replace('%d', String(this.max)) : null;
    this.errors.set(error ? [error] : []);
    let valid = !error;
    for (const row of untrack(this.rows)) valid = row.validateAll() && valid;
    return valid;
  }

  hasErrors(): boolean {
    return this.errors().length > 0 || this.rows().some(row => row.hasErrors());
  }

  addError(message: string): void {
    this.errors.update(errors => [...errors, message]);
  }

  /** Back to `min` empty rows. */
  reset(): void {
    this.setValues([]);
  }

  /** A path from the server: the index of a row, then the path inside it. */
  resolve(path: string[]): Member | null {
    const [index, ...rest] = path;
    const row = untrack(this.rows)[Number(index)];
    if (!row || !/^\d+$/.test(index ?? '')) return null;
    return rest.length === 0 ? row : row.resolve(rest);
  }

  focusFirstError(): boolean {
    return untrack(this.rows).some(row => row.focusFirstError());
  }

  collectToggles(into: Map<string, boolean>): void {
    for (const row of this.rows()) row.collectToggles(into);
  }

  /** After a change of the number of rows the message about it is updated, once it was shown. */
  private recheck(): void {
    if (untrack(this.errors).length > 0) {
      const count = untrack(this.rows).length;
      if (count >= this.min && (this.max === 0 || count <= this.max)) this.errors.set([]);
    }
  }
}
