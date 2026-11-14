/**
 * Multiplier: rows of controls the user adds, removes and orders, like contributte/forms-multiplier.
 * Every row is a Container made by the factory. The value is the list of the values of the rows, in their order.
 */
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
export declare class Multiplier<R extends object> implements Owner {
    private container;
    readonly name: string;
    private factory;
    /** Texts of the rows. Replace them for the language of the application. %d is the limit. */
    static texts: {
        add: string;
        remove: string;
        moveUp: string;
        moveDown: string;
        drag: string;
        min: string;
        max: string;
    };
    /** The rows in their order. */
    readonly rows: import("..").State<Container<R>[]>;
    /** Errors of the rows as a whole, e.g. too few of them. */
    readonly errors: import("..").State<string[]>;
    readonly label: string;
    readonly min: number;
    readonly max: number;
    constructor(container: Container<any>, name: string, factory: (row: Container<R>) => void, options?: MultiplierOptions);
    get form(): Form<any>;
    get idPrefix(): string;
    htmlName(key: string): string;
    canAdd(): boolean;
    canRemove(): boolean;
    /** Adds a row at the end, or at the given position. Returns it, or null when the limit is reached. */
    add(values?: DeepPartial<R>, at?: number): Container<R> | null;
    /** Removes a row unless it would leave fewer than `min`. Returns whether it was removed. */
    remove(row: Container<R>): boolean;
    /** Moves a row to another position. */
    move(row: Container<R>, to: number): void;
    getValues(): R[];
    /** As many rows as values (at least `min`), each filled with its values. */
    setValues(values: DeepPartial<R>[]): void;
    /** Checks the number of rows and every row. */
    validateAll(): boolean;
    hasErrors(): boolean;
    addError(message: string): void;
    /** Back to `min` empty rows. */
    reset(): void;
    /** A path from the server: the index of a row, then the path inside it. */
    resolve(path: string[]): Member | null;
    focusFirstError(): boolean;
    collectToggles(into: Map<string, boolean>): void;
    /** After a change of the number of rows the message about it is updated, once it was shown. */
    private recheck;
}
