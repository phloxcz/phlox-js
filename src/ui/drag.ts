/**
 * The base of dragging, shared by dragToSort() and the tree: it follows one pointer from a pointerdown
 * until it is let go, and scrolls when the pointer is held near an edge.
 */

import { allowsMotion } from './motion';

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

/** How close to the edge the pointer must be to scroll, and the fastest scrolling, in px per frame. */
const EDGE = 48;
const SPEED = 16;

/**
 * Follows the pointer of a pointerdown. Near an edge it scrolls the nearest scrolling element around
 * `inside` (a list, a dialog, or the page), faster the closer the pointer is.
 */
export function followPointer(event: PointerEvent, inside: Element, options: FollowOptions): void {
  const pointer = event.pointerId;
  let last: Point = { x: event.clientX, y: event.clientY };
  const scroller = scrollerOf(inside);
  // Limits taken before dragging: a dragged element can make the content larger, it would scroll on without end
  const max = { x: scroller.scrollWidth - scroller.clientWidth, y: scroller.scrollHeight - scroller.clientHeight };
  let frame = 0;

  // Listened on the window and not with setPointerCapture(): moving an element in the DOM
  // releases the capture, and the rest of the dragging would get lost.
  const onMove = (move: PointerEvent): void => {
    if (move.pointerId !== pointer) return;
    last = { x: move.clientX, y: move.clientY };
    options.move(last);
  };

  // A loop for the whole dragging: a pointer held at the edge does not send pointermove
  const scroll = (): void => {
    const area = scroller === document.scrollingElement
      ? { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth }
      : scroller.getBoundingClientRect();
    const was = { x: scroller.scrollLeft, y: scroller.scrollTop };
    scroller.scrollTop = Math.max(0, Math.min(max.y, was.y + speed(last.y, area.top, area.bottom)));
    scroller.scrollLeft = Math.max(0, Math.min(max.x, was.x + speed(last.x, area.left, area.right)));
    if (scroller.scrollTop !== was.y || scroller.scrollLeft !== was.x) options.move(last);
    frame = requestAnimationFrame(scroll);
  };

  const finish = (cancelled: boolean): void => {
    cancelAnimationFrame(frame);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey, true);
    options.end(cancelled);
  };
  const onUp = (up: PointerEvent): void => {
    if (up.pointerId === pointer) finish(false);
  };
  const onCancel = (cancel: PointerEvent): void => {
    if (cancel.pointerId === pointer) finish(true);
  };
  // Escape cancels the dragging, and does not close a dialog around it
  const onKey = (key: KeyboardEvent): void => {
    if (key.key !== 'Escape') return;
    key.preventDefault();
    key.stopPropagation();
    finish(true);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey, true);
  frame = requestAnimationFrame(scroll);
}

/** The nearest element that scrolls the given one: a scrolling list, a dialog, or the page. */
function scrollerOf(element: Element): Element {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const scrolls = /auto|scroll/.test(style.overflowY + style.overflowX);
    if (scrolls && (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth)) return parent;
  }
  return document.scrollingElement ?? document.documentElement;
}

/** Scrolling in one axis: back near the start of the area, forward near its end, nothing between. */
function speed(at: number, start: number, end: number): number {
  if (at < start + EDGE) return -Math.round(SPEED * Math.min(1, (start + EDGE - at) / EDGE));
  if (at > end - EDGE) return Math.round(SPEED * Math.min(1, (at - end + EDGE) / EDGE));
  return 0;
}

/** Animates an element from a shift back to its place, when animations are on (see setMotion). */
export function slide(element: HTMLElement, from: Point, duration = 150): void {
  if (!allowsMotion()) return;
  element.animate?.(
    [{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: 'none' }],
    { duration, easing: 'ease-out' },
  );
}
