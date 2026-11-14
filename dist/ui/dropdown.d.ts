/**
 * A button with a panel of any content: a menu of the user, notifications, a filter.
 * The panel is placed like the popover of confirm(), so a scrolled container does not clip it.
 */
import type { Child, Reactive } from './dom';
import type { Placement } from './messages';
export interface DropdownProps {
    /** Content of the button. */
    label: Child;
    /** The name of the button for screen readers, when the label is only an icon. */
    title?: string;
    /** Classes of the button, added to the theme slot `dropdown.button`. */
    class?: Reactive<string | undefined>;
    /** Classes of the panel, added to the theme slot `dropdown.panel`. */
    panelClass?: string;
    /** Where the panel is, it turns over when there is no room. */
    placement?: Placement;
    /** Called when the panel opens, e.g. to load what it shows. */
    onOpen?: () => void;
    children?: Child;
}
export interface DropdownItemProps {
    /** A link to go to; without it the item is a button. */
    href?: string;
    onClick?: (event: MouseEvent) => void;
    /** The current choice, e.g. the active view. */
    active?: Reactive<boolean>;
    disabled?: Reactive<boolean>;
    class?: string;
    children?: Child;
}
/** An item of a Dropdown menu, with the theme slot `dropdown.item`: a link with `href`, otherwise a button. */
export declare function DropdownItem(props: DropdownItemProps): Child;
/**
 * The panel opens by a click on the button. A click on a link or a button inside it, a click outside it
 * and Escape close it; then the focus goes back to the button. The content is created anew on every opening.
 */
export declare function Dropdown(props: DropdownProps): Child;
