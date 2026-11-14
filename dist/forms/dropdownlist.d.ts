/**
 * DropDownList: a select with a search field, taken over from phloxcz/forms-dropdownlist.
 * The same HTML classes, keyboard and look, so a list rendered by the server and one in the SPA match.
 * Instead of a URL it gets its items, or a function that searches them, typically an RPC call.
 */
import type { Child } from '../ui/dom';
import type { ExtraAttributes } from './controls';
import { ListControl } from './listbox';
import type { ListOptions } from './listbox';
export type DropDownListOptions<T, O = never> = ListOptions<T, O>;
export declare class DropDownList<T = string> extends ListControl<T> {
    /** Texts of the list. Replace them for the language of the application: DropDownList.texts.noResults = '...'. */
    static texts: {
        noResults: string;
        filterPlaceholder: string;
    };
    constructor(label?: string, options?: DropDownListOptions<T, any>);
    open(): void;
    /** After a pick the focus returns to the button, so the user can go on by Tab. */
    pick(value: T, label: string): void;
    private onFilterKey;
    render(attributes: ExtraAttributes): Child;
}
