/**
 * Ordering by dragging. Built on pointer events, so it works with a mouse, a pen and a finger,
 * without the HTML5 drag & drop, which does not work on touch screens and cannot be styled.
 *
 * The dragged item follows the pointer. It also moves in the data while it is dragged: the template
 * moves its element, the other items slide out of its way, and when it is let go it settles in its place.
 *
 * With `lists` it can also go to other lists, e.g. to another level of a tree of boxes. Over such a list
 * it does not move in the data (another template would make a new element for it): the list is marked,
 * a line shows the place, and when it is let go there, the list's drop() moves it in the data.
 */
type Layout = 'vertical' | 'horizontal' | 'grid';
export interface SortOptions {
    /** Elements of all items in their current order, the dragged one among them. */
    items: () => HTMLElement[];
    /** Moves the dragged item to this position in the data. */
    move: (to: number) => void;
    /** Called when the dragging ends. */
    done?: () => void;
    /** How the items are laid out: one under another (default), side by side, or in wrapping rows. */
    layout?: Layout;
    /** The item moves only along the layout, not freely. Not for a grid. */
    lockAxis?: boolean;
    /**
     * What decides the position: the middle of the dragged item (default), or the pointer. The pointer suits
     * items of very different sizes, e.g. a wide column before a narrow one: its middle would have to travel half
     * the row.
     */
    anchor?: 'middle' | 'pointer';
    /**
     * Other lists the item can be dropped into. A list inside the dragged item is left out, so an item
     * cannot go into itself. Needs `list`, the element of the item's own list.
     */
    lists?: () => SortList[];
    /** The element of the item's own list: with `lists`, the pointer over it orders the item there again. */
    list?: HTMLElement;
}
/** Another list for dragToSort(): where the item can be dropped. */
export interface SortList {
    /** The element of the list; the pointer over it (and not over a list inside it) chooses it. */
    element: HTMLElement;
    /** Elements of its items in their order. */
    items: () => HTMLElement[];
    layout?: Layout;
    /** The item was let go in this list at this position: move it there in the data. */
    drop: (to: number) => void;
}
/** Class of the dragged item while it is dragged. */
export declare const DRAGGING = "phlox-dragging";
/** Class of another list while the dragged item is over it, and of the line that shows the place. */
export declare const DROP_TARGET = "phlox-drop-target";
/**
 * Starts dragging `item` from a pointerdown on its handle:
 * <button onPointerdown={event => dragToSort(event, rowElement, { items, move })}>.
 * The position is chosen by the middle of the dragged item against the middles of the others.
 * Near an edge the list scrolls, see followPointer().
 */
export declare function dragToSort(event: PointerEvent, item: HTMLElement, options: SortOptions): void;
export {};
