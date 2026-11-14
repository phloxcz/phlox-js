/** Form controls, like Nette\Forms\Controls. Each holds its value in state, so templates follow it. */
import type { State } from '../reactive/reactive';
import type { Child } from '../ui/dom';
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
export declare function toPairs<T>(items: Items<T>): [T, string][];
export declare abstract class FormControl<T = unknown> {
    label: string;
    /** Set by the form when the control is added. */
    form: Form<any>;
    /** The form or a nested container the control is in. */
    container: Container<any>;
    name: string;
    readonly errors: State<string[]>;
    readonly disabled: State<boolean>;
    readonly rules: Rules;
    /** Left out of getValues(). Buttons are omitted, other controls can be by setOmitted(). */
    omitted: boolean;
    /** The element the user works with, for focus after a failed validation. */
    element: HTMLElement | null;
    /** The label is part of the input itself, e.g. a checkbox. */
    readonly labelInInput: boolean;
    /** The user has left the field after changing it: from now on the rules are checked while typing. */
    private touched;
    /** The user has changed the value, or opened its list. Leaving a field nobody has worked with checks nothing. */
    protected edited: boolean;
    /**
     * The value as a state, like a binding in MVVM. Given to a template without calling it, the text follows
     * typing: <h2>{control.value}</h2>. control.value() reads it, control.value.set(x) writes it to the field,
     * the same as getValue() and setValue().
     */
    readonly value: State<T>;
    constructor(label?: string);
    get htmlId(): string;
    /** The name attribute, like customer[city] in Nette for a control in a container. */
    get htmlName(): string;
    abstract getValue(): T;
    abstract setValue(value: T): void;
    abstract isFilled(): boolean;
    /** Renders the control, used by <Input>. */
    abstract render(attributes: ExtraAttributes): Child;
    setRequired(message?: string | boolean): this;
    isRequired(): boolean;
    addRule(validator: Validator, message?: string | null, arg?: unknown): this;
    addCondition(validator: Validator, arg?: unknown): Rules;
    addConditionOn(control: FormControl<any>, validator: Validator, arg?: unknown): Rules;
    setDisabled(disabled?: boolean): this;
    setOmitted(omitted?: boolean): this;
    addError(message: string): void;
    hasErrors(): boolean;
    cleanErrors(): void;
    /** Puts the focus into the control, e.g. after a failed validation or from a button "Write a comment". */
    focus(): void;
    /** As if the user had not worked with the control yet: no errors, leaving it checks nothing. Used by reset(). */
    pristine(): void;
    /** Checks the rules. A disabled control is not checked, as in Nette. */
    validate(): boolean;
    /** Attributes for an own element, like n:name in Latte: <input {...control.attrs()} class="x" />. */
    attrs(): Record<string, unknown>;
    /**
     * Classes of a rendered element: those of the theme slot, the `invalid` class while there is an error,
     * and the class passed to <Input>. Call it while rendering, the theme is the one of the running application.
     */
    protected classFor(attributes: ExtraAttributes, slot: string): () => string;
    /** After a change: once there is an error or the user has left the field, the rules are checked live. */
    protected changed(): void;
}
type TextKind = 'text' | 'integer' | 'float' | 'date';
/** Text field. With addInteger() and addFloat() its value is a number, with addDate() a text YYYY-MM-DD. */
export declare class TextInput<T = string> extends FormControl<T> {
    private kind;
    readonly raw: State<string>;
    private nullable;
    htmlType: string;
    constructor(label?: string, kind?: TextKind);
    /** An empty field gives null instead of ''. Number and date fields are nullable always. */
    setNullable(nullable?: boolean): this;
    setHtmlType(type: string): this;
    getRawValue(): string;
    getValue(): T;
    setValue(value: T): void;
    isFilled(): boolean;
    attrs(): Record<string, unknown>;
    render(attributes: ExtraAttributes): Child;
}
export declare class TextArea extends TextInput<string> {
    render(attributes: ExtraAttributes): Child;
}
export declare class Checkbox extends FormControl<boolean> {
    readonly checked: State<boolean>;
    readonly labelInInput = true;
    getValue(): boolean;
    setValue(value: boolean): void;
    isFilled(): boolean;
    attrs(): Record<string, unknown>;
    /** The checkbox inside its label, as in Nette. */
    render(attributes: ExtraAttributes): Child;
}
/** Common part of controls with choices. */
declare abstract class ChoiceControl<T, V> extends FormControl<V> {
    readonly items: State<[T, string][]>;
    constructor(label?: string, items?: Items<T>);
    /** Choices can be set later, e.g. when they come from the server. */
    setItems(items: Items<T>): this;
    protected indexOf(value: T): number;
}
export declare class SelectBox<T = string> extends ChoiceControl<T, T | null> {
    readonly selected: State<T | null>;
    private prompt;
    /** The first option without a value, like setPrompt() in Nette. */
    setPrompt(prompt: string | null): this;
    getValue(): T | null;
    setValue(value: T | null): void;
    isFilled(): boolean;
    render(attributes: ExtraAttributes): Child;
}
export declare class MultiSelectBox<T = string> extends ChoiceControl<T, T[]> {
    readonly selected: State<T[]>;
    getValue(): T[];
    setValue(value: T[]): void;
    isFilled(): boolean;
    render(attributes: ExtraAttributes): Child;
}
export declare class RadioList<T = string> extends ChoiceControl<T, T | null> {
    readonly selected: State<T | null>;
    getValue(): T | null;
    setValue(value: T | null): void;
    isFilled(): boolean;
    render(attributes: ExtraAttributes): Child;
}
export declare class CheckboxList<T = string> extends ChoiceControl<T, T[]> {
    readonly selected: State<T[]>;
    getValue(): T[];
    setValue(value: T[]): void;
    isFilled(): boolean;
    render(attributes: ExtraAttributes): Child;
}
export declare class HiddenField extends FormControl<string> {
    readonly raw: State<string>;
    getValue(): string;
    setValue(value: string): void;
    isFilled(): boolean;
    render(attributes: ExtraAttributes): Child;
}
export declare class SubmitButton extends FormControl<void> {
    caption: string;
    /** Controls validated when the form is sent by this button. An empty list validates nothing, e.g. for Cancel. */
    validationScope: FormControl<any>[] | null;
    constructor(caption?: string);
    setValidationScope(controls: FormControl<any>[] | null): this;
    /** Whether the form is being sent by this button, for the handler of onSuccess. */
    isSubmittedBy(): boolean;
    getValue(): void;
    setValue(): void;
    isFilled(): boolean;
    /** A class passed to <Input> replaces the one of the theme, e.g. class="btn btn-secondary" for Cancel. */
    render(attributes: ExtraAttributes): Child;
}
export {};
