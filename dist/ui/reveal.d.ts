/**
 * An element asks the containers around it (a tab, later others) to show it. Called before it gets the focus,
 * e.g. by focus() of a control of a form, because a focus into a hidden element would be lost.
 * A container listens to REVEAL on itself; the event bubbles.
 */
export declare const REVEAL = "phloxreveal";
export declare function reveal(element: Element | null | undefined): void;
