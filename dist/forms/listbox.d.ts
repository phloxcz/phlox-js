/**
 * What DropDownList and ComboBox share: items, loading them, the list with highlighted text,
 * moving through it by the keyboard and placing the panel next to the control.
 */
import type { Child } from '../ui/dom';
import { FormControl, toPairs } from './controls';
import type { Items } from './controls';
/** Items as values, or as pairs [value, label], or as an object { value: label }. */
export interface PlainItems<T> {
    /** Fixed items, filtered in the browser. */
    items?: Items<T>;
    /** Items for the typed text, e.g. from the server. Called with '' when the list opens. */
    search?: (query: string) => Promise<Items<T>> | Items<T>;
    /** Label of a value set from code, when it is not among the items, e.g. after setDefaults(). */
    label?: (value: T) => Promise<string | null> | string | null;
    /** Items shown but not to be chosen, e.g. value => value === 'archived'. */
    itemDisabled?: (value: T) => boolean;
    itemValue?: never;
    itemLabel?: never;
    template?: never;
}
/**
 * Items as objects, e.g. users from the server: `itemValue` says what of an item is the value,
 * `itemLabel` its text (searching, screen readers, the field of a combobox) and `template` how it looks.
 */
export interface ObjectItems<T, O> {
    items?: readonly O[];
    search?: (query: string) => Promise<readonly O[]> | readonly O[];
    /** Label or the whole item of a value set from code, when it is not among the items. */
    label?: (value: T) => Promise<string | O | null> | string | O | null;
    /** The value of an item. */
    itemValue: (item: O) => T;
    /** The text of an item. Without it the value as a text. */
    itemLabel?: (item: O) => string;
    /** How an item looks in the list (and as the chosen value or a tag), instead of its text. */
    template?: (item: O) => Child;
    /** Items shown but not to be chosen, e.g. user => !user.active. */
    itemDisabled?: (item: O) => boolean;
}
/** Items as plain values, or as objects with `itemValue`. */
export type ItemOptions<T, O = never> = PlainItems<T> | ObjectItems<T, O>;
export type ListOptions<T, O = never> = ItemOptions<T, O> & {
    /** Text shown while nothing is selected. */
    placeholder?: string;
};
/** What the controls keep of the options, the type of item objects is known only where they are given. */
type Known<T> = {
    itemValue?: (item: any) => T;
    itemLabel?: (item: any) => string;
    template?: (item: any) => Child;
    itemDisabled?: (item: any) => boolean;
};
/**
 * Text for searching: lower case and without diacritics, so 'nap' finds 'Nápoje'.
 * Character by character, so positions in it are positions in the original text.
 */
export declare function foldText(text: string): string;
export { toPairs };
/** Items as pairs of value and label. Objects (with `itemValue`) are remembered by their values for the template. */
export declare function itemPairs<T>(items: Items<T> | readonly unknown[], options: Known<T>, objects: Map<T, unknown>): [T, string][];
/** The label of a value given by a text or by an item object, which is remembered for the template. */
export declare function labelOf<T>(value: T, given: unknown, options: Known<T>, objects: Map<T, unknown>): string;
/** Is the item of this value disabled by `itemDisabled`? For objects, the object must be known (loaded or given). */
export declare function isDisabledItem<T>(value: T, options: Known<T>, objects: Map<T, unknown>): boolean;
/** The index next to `from` in the direction, skipping disabled items; `from` when there is none. `wrap` goes round. */
export declare function nextIndex(count: number, from: number, step: 1 | -1, disabled: (index: number) => boolean, wrap?: boolean): number;
/** The template of a known item object, otherwise the text. */
export declare function itemContent<T>(value: T, text: Child, options: Known<T>, objects: Map<T, unknown>): Child;
export declare abstract class ListControl<T> extends FormControl<T | null> {
    protected options: ListOptions<T, any>;
    readonly selected: import("..").State<T | null>;
    /** Label of the selected value. */
    readonly selectedLabel: import("..").State<string>;
    readonly opened: import("..").State<boolean>;
    readonly items: import("..").State<[T, string][]>;
    /** Index of the item highlighted by the keyboard, -1 for none. */
    readonly active: import("..").State<number>;
    /** The text the items are searched by. */
    readonly query: import("..").State<string>;
    placeholder: string;
    protected readonly listId: string;
    /** Item objects by their values, see ItemOptions. */
    protected readonly objects: Map<T, unknown>;
    private all;
    private request;
    private timer;
    constructor(label: string, options: ListOptions<T, any>, idPrefix: string);
    setItems(items: Items<T> | readonly unknown[]): this;
    setPlaceholder(placeholder: string): this;
    getValue(): T | null;
    /**
     * Sets the value. The label (or the item object) can be given, e.g. when the data from the server have it
     * already, otherwise it comes from the items, or from the `label` option.
     */
    setValue(value: T | null, label?: unknown): void;
    isFilled(): boolean;
    close(): void;
    /** Is the item disabled by the option `itemDisabled`? It is shown in the list but cannot be picked. */
    isItemDisabled(value: T): boolean;
    /** Can the user change the value now: not disabled, not read-only. */
    protected changeable(): boolean;
    /** Selects an item from the list and closes it. A disabled item is not picked. */
    pick(value: T, label: string): void;
    protected findItem(value: T): [T, string] | undefined;
    /** Searches for the text: fixed items at once, `search` after a pause in typing. */
    protected searchFor(text: string): void;
    /** Fixed items are filtered here, otherwise `search` is asked. An older answer never overwrites a newer one. */
    protected load(query: string): Promise<void>;
    /** Arrow keys move the highlight, over disabled items. Returns whether the key was one of them. */
    protected moveActive(event: KeyboardEvent, stopAtFirst?: boolean): boolean;
    /** The highlighted item, if any. */
    protected activeItem(): [T, string] | undefined;
    /** Items of the list, or a line saying there are none. `slot` gives classes of the theme. */
    protected renderItems(slot: (name: string) => string, noResults: () => string): Child;
    /** Cleans up a pending search. Call it while rendering. */
    protected cleanUpSearch(): void;
    /** Keeps the highlighted and the selected item in view. */
    private scrollWhenActive;
    /** Places the panel next to the control, see placePanel(). */
    protected place(panel: HTMLElement, list: HTMLElement): void;
}
/**
 * Places the panel `fixed` next to the control. Unlike `absolute` in the PHP versions,
 * a dialog or another scrolling container around it does not cut it off.
 *
 * It opens below. When the whole list would not fit there and there is more room above,
 * it opens above. When it fits on neither side, the list gets shorter. The side is chosen by the
 * full height of the list, not by the items shown now, so it does not jump while the user types.
 * `list` is the scrolling part of the panel, or the panel itself.
 */
export declare function placePanel(anchorOf: () => Element | null, panel: HTMLElement, list: HTMLElement): void;
/** The label with the searched text in <mark>, as text, never as HTML. Diacritics do not matter. */
export declare function highlight(label: string, query: string, markClass: string): Child;
