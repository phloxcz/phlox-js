/**
 * Form, like Nette\Forms\Form. V is the type of its values, usually a DTO generated from PHP.
 * The controls are added by methods of Container, which a form is, as in Nette.
 */
import type { Accessor } from '../reactive/reactive';
import { FormControl, SubmitButton } from './controls';
import { Container } from './container';
import type { Validator } from './rules';
import type { DeepPartial } from './container';
export declare class Form<V extends object = Record<string, any>> extends Container<V> {
    static Filled: Validator;
    static Required: Validator;
    static Blank: Validator;
    static Equal: Validator;
    static NotEqual: Validator;
    static MinLength: Validator;
    static MaxLength: Validator;
    static Length: Validator;
    static Email: Validator;
    static URL: Validator;
    static Pattern: Validator;
    static Integer: Validator;
    static Numeric: Validator;
    static Float: Validator;
    static Min: Validator;
    static Max: Validator;
    static Range: Validator;
    static IsIn: Validator;
    static MaxFileSize: Validator;
    static MimeType: Validator;
    static Image: Validator;
    /** Default messages of the rules, keyed by the validator: Form.messages.set(Form.Filled, 'Vyplňte.'). */
    static messages: Map<Validator, string>;
    readonly id: string;
    /** Submit buttons of the whole form, also those added to containers. */
    readonly buttons: Map<string, SubmitButton>;
    /** Errors of the whole form, not of one control. */
    readonly errors: import("..").State<string[]>;
    /** The values the form was filled with or last saved, see isChanged(). */
    private saved;
    /**
     * True when the values differ from the saved ones: those from setDefaults(), after a successful submit,
     * after reset(), or those the form had when it was first rendered. For Component.hasUnsavedChanges().
     */
    readonly isChanged: Accessor<boolean>;
    /** True while onSuccess runs. Submit buttons are disabled meanwhile. */
    readonly submitting: import("..").State<boolean>;
    /** Called with the values when the form is sent and valid. An RpcError with invalid fields is shown at the fields. */
    onSuccess: ((values: V, form: this) => void | Promise<void>) | null;
    /** Called when the form is sent but not valid. */
    onError: ((form: this) => void) | null;
    submittedBy: SubmitButton | null;
    /** The button the user clicked, set by the button. */
    clickedButton: SubmitButton | null;
    element: HTMLFormElement | null;
    /** Elements switched by toggle() in rules: id → visible. */
    readonly toggles: Accessor<Map<string, boolean>>;
    get form(): Form<any>;
    get idPrefix(): string;
    htmlName(name: string): string;
    getButton(name: string): SubmitButton;
    /** Fills the controls, typically with data loaded from the server. The same as setValues(). */
    setDefaults(values: DeepPartial<V>): this;
    /** The current values are the saved ones, isChanged() is false. For saving outside onSuccess. */
    markSaved(): void;
    /** @internal The first rendering remembers the values unless something has been saved before. */
    markRendered(): void;
    /** Checks the given controls, or the whole form. Returns whether they are valid. */
    validate(controls?: Iterable<FormControl<any>>): boolean;
    hasErrors(): boolean;
    addError(message: string): void;
    /**
     * Shows errors of invalid parameters from the server at the controls. Paths such as `input.name`
     * lead to the control `name`, `input.lines.2.quantity` to the quantity in the third row.
     * A path with no control becomes an error of the form. Returns whether the error had such fields.
     */
    addServerErrors(error: unknown, prefix?: string): boolean;
    /**
     * Validates and calls onSuccess, as when the user sends the form.
     * Returns whether it went through. An error thrown by onSuccess is thrown on,
     * except invalid parameters from the server, which are shown at the controls.
     */
    submit(button?: SubmitButton | null): Promise<boolean>;
    /** Empties all controls and errors. */
    reset(): void;
}
export type { Validator };
