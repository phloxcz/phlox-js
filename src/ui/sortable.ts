/**
 * Ordering by dragging. Built on pointer events, so it works with a mouse, a pen and a finger,
 * without the HTML5 drag & drop, which does not work on touch screens and cannot be styled.
 *
 * The dragged item follows the pointer. It also moves in the data while it is dragged: the template
 * moves its element, the other items slide out of its way, and when it is let go it settles in its place.
 */

import { followPointer, slide } from './drag';
import type { Point } from './drag';

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
export const DRAGGING = 'phlox-dragging';

const middle = (box: DOMRect): Point => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 });

/** Whether an item with the middle `other` and the box `box` lies before the point `at` in the layout. */
function isBefore(layout: SortOptions['layout'], other: Point, box: DOMRect, at: Point): boolean {
  if (layout === 'horizontal') return other.x < at.x;
  if (layout === 'grid') {
    // A row above, or the same row and to the left: the order of reading
    return other.y < at.y - box.height / 2 || (Math.abs(other.y - at.y) <= box.height / 2 && other.x < at.x);
  }
  return other.y < at.y;
}

/**
 * Starts dragging `item` from a pointerdown on its handle:
 * <button onPointerdown={event => dragToSort(event, rowElement, { items, move })}>.
 * The position is chosen by the middle of the dragged item against the middles of the others.
 * Near an edge the list scrolls, see followPointer().
 */
export function dragToSort(event: PointerEvent, item: HTMLElement, options: SortOptions): void {
  if (event.button !== 0) return;
  event.preventDefault();
  const { layout = 'vertical', lockAxis = false } = options;
  const start = item.getBoundingClientRect();
  // Where the item was grabbed, so it does not jump under the pointer
  const grab = { x: event.clientX - start.left, y: event.clientY - start.top };
  const shift = { x: 0, y: 0 };
  let last: Point = { x: event.clientX, y: event.clientY };
  item.classList.add(DRAGGING);

  /** Moves the item under the pointer: its place in the layout plus a shift by transform. */
  const follow = (): void => {
    const box = item.getBoundingClientRect();
    const place = { x: box.left - shift.x, y: box.top - shift.y };
    shift.x = lockAxis && layout === 'vertical' ? 0 : last.x - grab.x - place.x;
    shift.y = lockAxis && layout === 'horizontal' ? 0 : last.y - grab.y - place.y;
    item.style.transform = `translate(${shift.x}px, ${shift.y}px)`;
  };

  /** Moves the item under the pointer and to its place in the order. */
  const update = (pointer: Point): void => {
    last = pointer;
    follow();
    const items = options.items();
    const others = items.filter(other => other !== item);
    const at = middle(item.getBoundingClientRect());
    const before = others.filter(other => {
      const box = other.getBoundingClientRect();
      return isBefore(layout, middle(box), box, at);
    }).length;
    if (before === items.indexOf(item)) return;

    // The others slide from their old places to the new ones (FLIP)
    const old = new Map(others.map(other => [other, other.getBoundingClientRect()]));
    options.move(before);
    follow();
    for (const other of others) {
      const was = old.get(other)!;
      const now = other.getBoundingClientRect();
      if (was.left !== now.left || was.top !== now.top) slide(other, { x: was.left - now.left, y: was.top - now.top });
    }
  };

  followPointer(event, item, {
    move: update,
    // Also a cancelled dragging keeps the new order: the item has moved in the data all along
    end: () => {
      item.classList.remove(DRAGGING);
      item.style.transform = '';
      // The dropped item settles in its place instead of jumping there
      if (shift.x || shift.y) slide(item, shift);
      options.done?.();
    },
  });
}
