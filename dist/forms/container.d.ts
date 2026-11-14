/**
 * Container: a group of controls with its own part of the values, like Nette\Forms\Container.
 * Form is a container too. addContainer() nests a DTO object, addMultiplier() a list of rows.
 */
import { Checkbox, CheckboxList, FormControl, HiddenField, MultiSelectBox, RadioList, SelectBox, SubmitButton, TextArea, TextInput } from './controls';
import type { Items } from './controls';
import { DropDownList } from './dropdownlist';
import type { DropDownListOptions } from './dropdownlist';
import { ComboBox } from './combobox';
import type { ComboBoxOptions } from './combobox';
import { TagInput } from './taginput';
import { UploadControl } from './upload';
import { EditorControl } from './editor';
import type { EditorOptions } from './editor';
import { TreeSelect } from './treeselect';
import type { TreeSelectOptions } from './treeselect';
import { DropDownTreeSelect } from './dropdowntree';
import type { DropDownTreeSelectOptions } from './dropdowntree';
import type { TreeKey } from '../components/tree';
import type { TagInputOptions } from './taginput';
import { Multiplier } from './multiplier';
import type { MultiplierOptions } from './multiplier';
import type { Form } from './form';
/** Names of the values of V that can hold a T: addText() needs a text field of the DTO, addInteger() a number. */
export type KeysFor<V, T> = {
    [K in keyof V]-?: T extends V[K] ? K : never;
}[keyof V] & string;
export type ListKeys<V> = {
    [K in keyof V]-?: NonNullable<V[K]> extends readonly unknown[] ? K : never;
}[keyof V] & string;
export type ItemOf<L> = NonNullable<L> extends readonly (infer E)[] ? E : never;
/** Names of nested objects of V, for addContainer(). */
export type ObjectKeys<V> = {
    [K in keyof V]-?: NonNullable<V[K]> extends readonly unknown[] ? never : NonNullable<V[K]> extends object ? K : never;
}[keyof V] & string;
/** Names of lists of objects of V, for addMultiplier(). */
/** Values that may leave out any field, also in nested objects and rows. Defaults are usually incomplete. */
export type DeepPartial<T> = T extends readonly (infer E)[] ? DeepPartial<E>[] : T extends object ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : T;
export type RowListKeys<V> = {
    [K in ListKeys<V>]: ItemOf<V[K]> extends object ? K : never;
}[ListKeys<V>] & string;
/** What a container belongs to: the form, a parent container, or a multiplier for its rows. */
export interface Owner {
    readonly form: Form<any>;
    /** Start of the ids of the elements inside, so they are unique in the page. */
    readonly idPrefix: string;
    /** The name attribute of a member, like customer[city] in Nette. */
    htmlName(name: string): string;
}
export type Member = FormControl<any> | Container<any> | Multiplier<any>;
export declare class Container<V extends object = Record<string, any>> implements Owner {
    private owner;
    private segment;
    /** Controls, containers and multipliers in the order they were added. */
    readonly members: Map<string, Member>;
    /** Shown as the legend of the group by <FormView>. */
    label: string;
    constructor(owner?: Owner | null, segment?: string);
    get form(): Form<any>;
    get idPrefix(): string;
    htmlName(name: string): string;
    /** Controls directly in this container, without buttons. */
    get controls(): FormControl<any>[];
    /** Adds an own control, the way the add*() methods do. */
    addControl<C extends FormControl<any>>(name: string, control: C): C;
    /** A nested group of controls for an object of the DTO, like $form->addContainer() in Nette. */
    addContainer<K extends ObjectKeys<V>>(name: K, label?: string): Container<NonNullable<V[K]>>;
    /**
     * Rows that the user adds, removes and orders, for a list of objects of the DTO.
     * `factory` adds the controls of one row, like addMultiplier() of contributte/forms-multiplier.
     */
    addMultiplier<K extends RowListKeys<V>>(name: K, factory: (row: Container<ItemOf<V[K]> & object>) => void, options?: MultiplierOptions): Multiplier<ItemOf<V[K]> & object>;
    addText(name: KeysFor<V, string>, label?: string, maxLength?: number): TextInput<string>;
    addPassword(name: KeysFor<V, string>, label?: string): TextInput<string>;
    addEmail(name: KeysFor<V, string>, label?: string): TextInput<string>;
    addTextArea(name: KeysFor<V, string>, label?: string): TextArea;
    /** WYSIWYG editor, the value is HTML. Options of phlox-editor: toolbar, upload, placeholder… */
    addEditor(name: KeysFor<V, string>, label?: string, options?: EditorOptions): EditorControl;
    /** A whole number, null when empty. */
    addInteger(name: KeysFor<V, number | null>, label?: string): TextInput<number | null>;
    /** A number, also with a decimal comma, null when empty. */
    addFloat(name: KeysFor<V, number | null>, label?: string): TextInput<number | null>;
    /** A date as text YYYY-MM-DD, the way a DTO receives it, null when empty. */
    addDate(name: KeysFor<V, string | null>, label?: string): TextInput<string | null>;
    addCheckbox(name: KeysFor<V, boolean>, caption?: string): Checkbox;
    addSelect<K extends keyof V & string>(name: K, label?: string, items?: Items<NonNullable<V[K]>>): SelectBox<NonNullable<V[K]>>;
    addMultiSelect<K extends ListKeys<V>>(name: K, label?: string, items?: Items<ItemOf<V[K]>>): MultiSelectBox<ItemOf<V[K]>>;
    addRadioList<K extends keyof V & string>(name: K, label?: string, items?: Items<NonNullable<V[K]>>): RadioList<NonNullable<V[K]>>;
    addCheckboxList<K extends ListKeys<V>>(name: K, label?: string, items?: Items<ItemOf<V[K]>>): CheckboxList<ItemOf<V[K]>>;
    /** A select with a search field, see DropDownList. Items are fixed, or come from `search`. */
    addDropDownList<K extends keyof V & string, O = never>(name: K, label?: string, options?: DropDownListOptions<NonNullable<V[K]>, O>): DropDownList<NonNullable<V[K]>>;
    /**
     * A text field with suggestions, see ComboBox. The value is a picked item. `allowCustom` lets a typed text
     * be the value too, so it is allowed only for fields that can hold a text.
     */
    addComboBox<K extends keyof V & string, O = never>(name: K, label?: string, options?: ComboBoxOptions<NonNullable<V[K]>, O> & {
        allowCustom?: string extends V[K] ? boolean : false;
    }): ComboBox<NonNullable<V[K]>>;
    /**
     * Several values as tags, see TagInput. The field must be a list. `allowNew` makes tags of typed text,
     * so it is allowed only for lists that can hold texts.
     */
    addTagInput<K extends ListKeys<V>, O = never>(name: K, label?: string, options?: TagInputOptions<ItemOf<V[K]>, O> & {
        allowNew?: string extends ItemOf<V[K]> ? boolean : false;
    }): TagInput<ItemOf<V[K]>>;
    /** One file, File or null. Nothing is uploaded: onSuccess gets the File and sends it the way it needs. */
    addUpload(name: KeysFor<V, File | null>, label?: string): UploadControl<File | null>;
    /** Several files, File[]. The number of them is checked by Form.MinLength and Form.MaxLength, as in Nette. */
    addMultiUpload(name: KeysFor<V, File[]>, label?: string): UploadControl<File[]>;
    /** One node of a tree, its id or null. Nodes come at once (`nodes`) or level by level (`load`). */
    addTreeSelect<K extends keyof V & string>(name: K, label?: string, options?: TreeSelectOptions<NonNullable<V[K]> & TreeKey>): TreeSelect<NonNullable<V[K]> & TreeKey, (NonNullable<V[K]> & TreeKey) | null>;
    /**
     * One node of a tree in a drop-down: closed it shows the way to the picked node, open the tree.
     * A lazy tree needs `path`, so the way to a node set from code can be loaded.
     */
    addDropDownTreeSelect<K extends keyof V & string>(name: K, label?: string, options?: DropDownTreeSelectOptions<NonNullable<V[K]> & TreeKey>): DropDownTreeSelect<NonNullable<V[K]> & TreeKey>;
    /** Several nodes of a tree, a list of ids. */
    addTreeMultiSelect<K extends ListKeys<V>>(name: K, label?: string, options?: TreeSelectOptions<ItemOf<V[K]> & TreeKey>): TreeSelect<ItemOf<V[K]> & TreeKey, (ItemOf<V[K]> & TreeKey)[]>;
    addHidden(name: KeysFor<V, string>, value?: string): HiddenField;
    /** A button is not among the values. Several buttons can be told apart by isSubmittedBy(). */
    addSubmit(name: string, caption?: string): SubmitButton;
    get<K extends keyof V & string>(name: K): FormControl<V[K]>;
    getContainer<K extends ObjectKeys<V>>(name: K): Container<NonNullable<V[K]>>;
    getMultiplier<K extends RowListKeys<V>>(name: K): Multiplier<ItemOf<V[K]> & object>;
    /** Values of the container, without disabled and omitted controls. Reads state, so a template follows it. */
    getValues(): V;
    /** Fills the controls, also nested containers and rows, typically with data loaded from the server. */
    setValues(values: DeepPartial<V>): this;
    /** Checks all controls inside, also nested. Returns whether they are valid. */
    validateAll(): boolean;
    hasErrors(): boolean;
    /** Empties all controls inside and their errors. */
    reset(): void;
    /** Finds what a path from the server leads to, e.g. ['customer', 'city'] or ['lines', '2', 'quantity']. */
    resolve(path: string[]): Member | null;
    /** Focuses the first control with an error. Returns whether there was one. */
    focusFirstError(): boolean;
    /** Visibility of elements switched by toggle() in rules of the controls inside. */
    collectToggles(into: Map<string, boolean>): void;
    private checkName;
}
