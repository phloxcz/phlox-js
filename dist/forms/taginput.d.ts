/**
 * TagInput: several values as tags, taken over from phloxcz/forms-taginput.
 * Tags are picked from suggestions shown while typing, or with `allowNew` made of the typed text.
 * Comma and Enter add a tag, Backspace in an empty field removes the last one.
 */
import type { Child } from '../ui/dom';
import { FormControl } from './controls';
import type { ExtraAttributes, Items } from './controls';
import type { ItemOptions } from './listbox';
/** Suggestions as plain values, or as objects with `itemValue`, see ItemOptions. */
export type TagInputOptions<T, O = never> = ItemOptions<T, O> & {
    /** Typed text that is not a suggestion becomes a new tag. Only for lists of texts. */
    allowNew?: boolean;
    /** At most this many tags, 0 = no limit. */
    maxTags?: number;
    placeholder?: string;
};
export interface Tag<T> {
    value: T;
    label: string;
    /** Made of typed text, not picked from the suggestions. */
    isNew: boolean;
    /** A suggestion that cannot be picked, see the option itemDisabled. */
    disabled?: boolean;
}
export declare class TagInput<T = string> extends FormControl<T[]> {
    private options;
    /** Texts of the control. Replace them for the language of the application. */
    static texts: {
        createNew: string;
        remove: string;
    };
    readonly tags: import("..").State<Tag<T>[]>;
    readonly text: import("..").State<string>;
    /** Suggestions for the typed text, without tags already added. The last one may be a new tag. */
    readonly suggestions: import("..").State<Tag<T>[]>;
    readonly active: import("..").State<number>;
    readonly focused: import("..").State<boolean>;
    readonly opened: import("..").Accessor<boolean>;
    placeholder: string;
    private all;
    /** Item objects by their values, see ItemOptions. */
    private readonly objects;
    private request;
    private timer;
    private readonly listId;
    /** Leaving the field validates, but does not turn the typed text into a tag. */
    private leaving;
    constructor(label?: string, options?: TagInputOptions<T, any>);
    setItems(items: Items<T> | readonly unknown[]): this;
    getValue(): T[];
    /** Values picked from the suggestions and texts of new tags apart, like getSplitValue() in PHP. */
    getSplitValue(): {
        picked: T[];
        created: string[];
    };
    /**
     * Sets the tags. Labels (or item objects) can be given, e.g. when the data from the server have them,
     * otherwise they come from the items, or from the `label` option.
     */
    setValue(values: T[], labels?: unknown[]): void;
    isFilled(): boolean;
    /** Whether the limit of tags is reached. */
    full(): boolean;
    /** Is the item disabled by the option `itemDisabled`? It is suggested but cannot be added. */
    isItemDisabled(value: T): boolean;
    /** Adds a tag unless it is there already (texts regardless of case), disabled, or the limit is reached. */
    add(value: T, label: string, isNew?: boolean): boolean;
    remove(tag: Tag<T>): void;
    /**
     * Turns typed text into a tag: a suggestion with exactly this label, or a new tag with allowNew.
     * Returns whether a tag was added.
     */
    commitText(text: string): boolean;
    /**
     * Text left in the field becomes a tag before the rules are checked, as it would after Enter.
     * Not when the user only leaves the field: a new tag would make the form taller, and a click on a button
     * below it, e.g. Save, would end somewhere else.
     */
    validate(): boolean;
    private has;
    /** Suggestions for the text: matching items not yet added, then a new tag when allowed and not an exact item. */
    private suggest;
    /** The highlighted suggestion, or the first one that can be picked. */
    private chosen;
    private onInput;
    private onKey;
    render(attributes: ExtraAttributes): Child;
}
