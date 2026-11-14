/**
 * ComboBox: a text field with a list of suggestions, taken over from phloxcz/forms-combobox.
 * The value is an item picked from the list. Typed text that is not an item is thrown away
 * when the user leaves the field, unless `allowCustom` is on: then the typed text is the value.
 */
import type { Child } from '../ui/dom';
import type { ExtraAttributes } from './controls';
import { ListControl } from './listbox';
import type { ListOptions } from './listbox';
export type ComboBoxOptions<T, O = never> = ListOptions<T, O> & {
    /** Typed text that is not an item becomes the value. Only for fields that can hold a text. */
    allowCustom?: boolean;
};
/** With item objects the template shows in the list only, the field shows the text of the item. */
export declare class ComboBox<T = string> extends ListControl<T> {
    protected options: ComboBoxOptions<T, any>;
    /** Texts of the list. Replace them for the language of the application. */
    static texts: {
        noResults: string;
    };
    /** True while the field shows what the user is typing, not the label of the value. */
    readonly editing: import("..").State<boolean>;
    private previous;
    private custom;
    constructor(label?: string, options?: ComboBoxOptions<T, any>);
    /** Whether the value is a typed text, not an item. Only with `allowCustom`. */
    isCustom(): boolean;
    setValue(value: T | null, label?: unknown): void;
    pick(value: T, label: string): void;
    /** The field gets the focus: the list opens with the first items, the current value is remembered for Escape. */
    open(): void;
    /** The value Escape returns to: the one before the list opened or before typing started. */
    private remember;
    /** Escape: back to the value before editing. */
    restore(): void;
    /**
     * Settles typed text: an item with exactly this label is picked, otherwise the text becomes the value
     * (with allowCustom), or it is thrown away and the previous value returns.
     */
    commit(): void;
    /** Typed text is settled before the rules are checked, e.g. when Enter sends the form. */
    validate(): boolean;
    private onKey;
    render(attributes: ExtraAttributes): Child;
}
