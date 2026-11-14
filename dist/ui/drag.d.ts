/**
 * The base of dragging, shared by dragToSort() and the tree: it follows one pointer from a pointerdown
 * until it is let go, and scrolls when the pointer is held near an edge.
 */
export interface Point {
    x: number;
    y: number;
}
export interface FollowOptions {
    /** The pointer moved, or the content under it scrolled. */
    move: (pointer: Point) => void;
    /** The pointer was let go, or the dragging was cancelled by Escape or by the browser. */
    end: (cancelled: boolean) => void;
}
/**
 * Follows the pointer of a pointerdown. Near an edge it scrolls the nearest scrolling element around
 * `inside` (a list, a dialog, or the page), faster the closer the pointer is.
 */
export declare function followPointer(event: PointerEvent, inside: Element, options: FollowOptions): void;
/** Animates an element from a shift back to its place, when animations are on (see setMotion). */
export declare function slide(element: HTMLElement, from: Point, duration?: number): void;
