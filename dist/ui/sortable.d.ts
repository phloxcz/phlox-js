/**
 * Ordering by dragging. Built on pointer events, so it works with a mouse, a pen and a finger,
 * without the HTML5 drag & drop, which does not work on touch screens and cannot be styled.
 *
 * The dragged item follows the pointer. It also moves in the data while it is dragged: the template
 * moves its element, the other items slide out of its way, and when it is let go it settles in its place.
 */
export interface SortOptions {
    /** Elements of all items in their current order, the dragged one among them. */
    items: () => HTMLElement[];
    /** Moves the dragged item to this position in the data. */
    move: (to: number) => void;
    /** Called when the dragging ends. */
    done?: () => void;
    /** How the items are laid out: one under another (default), side by side, or in wrapping rows. */
    layout?: 'vertical' | 'horizontal' | 'grid';
    /** The item moves only along the layout, not freely. Not for a grid. */
    lockAxis?: boolean;
}
/** Class of the dragged item while it is dragged. */
export declare const DRAGGING = "phlox-dragging";
/**
 * Starts dragging `item` from a pointerdown on its handle:
 * <button onPointerdown={event => dragToSort(event, rowElement, { items, move })}>.
 * The position is chosen by the middle of the dragged item against the middles of the others.
 * Near an edge the list scrolls, see followPointer().
 */
export declare function dragToSort(event: PointerEvent, item: HTMLElement, options: SortOptions): void;
