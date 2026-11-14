/**
 * A handle at the edge of an element that changes its width: a column of a layout, a side panel.
 * The width is a state, so with Component.preference() it is remembered.
 */
import type { State } from '../reactive/reactive';
import type { Child } from './dom';
export interface ResizeHandleProps {
    /** The width in px. The element uses it, e.g. style={() => ({ width: `${width()}px` })}. */
    size: State<number>;
    min?: number;
    max?: number;
    /** The edge the handle is at: `end` (right, default) or `start` (left, the element grows to the left). */
    edge?: 'end' | 'start';
    /** A double click returns to this width. */
    initial?: number;
    /** The name for screen readers, e.g. 'Šířka seznamu úkolů'. */
    label?: string;
}
/**
 * Put it as the last child of the element whose width it changes; base.css positions that element.
 * Dragging by the mouse or a finger, Escape during dragging returns the width. With the focus on it
 * arrows change the width, Home and End set the smallest and the largest.
 */
export declare function ResizeHandle(props: ResizeHandleProps): Child;
