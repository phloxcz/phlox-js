/** Validation rules and conditions, like Nette\Forms\Rules. */
import type { FormControl } from './controls';
/** Checks a control. `arg` is what was passed to addRule(), e.g. the length for MinLength. */
export type Validator = (control: FormControl<any>, arg?: any) => boolean;
/** Image formats of Form.Image, the same as in Nette. */
export declare const IMAGE_TYPES: string[];
/** The validators, also available as Form.Filled, Form.Email and so on. */
export declare const validators: {
    Filled: Validator;
    Blank: Validator;
    Equal: Validator;
    NotEqual: Validator;
    MinLength: Validator;
    MaxLength: Validator;
    Length: Validator;
    Email: Validator;
    URL: Validator;
    Pattern: Validator;
    Integer: Validator;
    Float: Validator;
    Min: Validator;
    Max: Validator;
    Range: Validator;
    IsIn: Validator;
    MaxFileSize: Validator;
    MimeType: Validator;
    Image: Validator;
};
/** Checks of one file, so an upload can mark which of its files breaks a rule. */
export declare const fileChecks: Map<Validator, (file: File, arg: unknown) => boolean>;
/** Messages used when addRule() gets none. Replace them for the language of the application. */
export declare const messages: Map<Validator, string>;
export declare class Rules {
    private control;
    private parent;
    private items;
    private toggles;
    /** The condition this set of rules belongs to, for elseCondition(). */
    private owner;
    constructor(control: FormControl<any>, parent?: Rules | null);
    addRule(validator: Validator, message?: string | null, arg?: unknown): this;
    /** Rules added after this apply only when the condition holds, until endCondition(). */
    addCondition(validator: Validator, arg?: unknown): Rules;
    /** The same as addCondition(), but the condition checks another control. */
    addConditionOn(control: FormControl<any>, validator: Validator, arg?: unknown): Rules;
    /** Rules for when the condition does not hold. */
    elseCondition(): Rules;
    endCondition(): Rules;
    /** Shows the element with the id while the condition holds, hides it otherwise. With false the other way round. */
    toggle(id: string, show?: boolean): this;
    /** Makes the control required, or not. In a condition it is required only while the condition holds. */
    setRequired(message?: string | boolean): this;
    isRequired(): boolean;
    /** Rules that apply now: the own ones and those of conditions that hold. */
    active(): {
        validator: Validator;
        arg: unknown;
    }[];
    /** Returns the first error, as Nette stops at the first rule that fails. */
    validate(): string | null;
    /** Visibility of toggled elements: shown when any rule says so. */
    collectToggles(into: Map<string, boolean>, active?: boolean): void;
}
