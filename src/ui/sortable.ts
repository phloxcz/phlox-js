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
 * Between lists a copy of the item follows the pointer in the top layer, so a scrolling list does not cut it off;
 * the item itself stays hidden in its place.
 */

import { followPointer, slide } from './drag';
import type { Point } from './drag';

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
export const DRAGGING = 'phlox-dragging';
/** Class of another list while the dragged item is over it, and of the line that shows the place. */
export const DROP_TARGET = 'phlox-drop-target';
const MARKER = 'phlox-drop-marker';
/** Class of the copy that follows the pointer when the item can go to other lists. */
const COPY = 'phlox-drag-copy';

/** Puts an element on <body> into the top layer: above everything, also a modal dialog, and no overflow cuts it. */
function toTopLayer(element: HTMLElement): void {
  if (typeof element.showPopover !== 'function') return;
  element.popover = 'manual';
  element.showPopover();
}

/**
 * A copy of the dragged item on <body>, in the top layer. It takes the computed style of the item, so it looks
 * the same out of its list; without ids and names (a copied radio would take the choice of the original),
 * it cannot be focused and the pointer goes through it.
 */
function dragCopy(item: HTMLElement): HTMLElement {
  const copy = item.cloneNode(true) as HTMLElement;
  for (const element of [copy, ...copy.querySelectorAll('[id], [name]')]) {
    element.removeAttribute('id');
    element.removeAttribute('name');
  }
  const computed = getComputedStyle(item);
  for (const name of Array.from(computed)) copy.style.setProperty(name, computed.getPropertyValue(name));
  const box = item.getBoundingClientRect();
  Object.assign(copy.style, {
    position: 'fixed', left: `${box.left}px`, top: `${box.top}px`, right: 'auto', bottom: 'auto',
    width: `${box.width}px`, height: `${box.height}px`, boxSizing: 'border-box', margin: '0',
    transform: 'none', transition: 'none', animation: 'none', pointerEvents: 'none', visibility: 'visible',
    // Below the line of the place; matters only where the top layer is missing
    zIndex: '2147482999',
  });
  copy.classList.add(COPY);
  copy.inert = true;
  copy.setAttribute('aria-hidden', 'true');
  document.body.append(copy);
  toTopLayer(copy);
  return copy;
}

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

/** How many of `items` lie before the point in the layout: the position among them. */
function positionAmong(items: HTMLElement[], layout: SortOptions['layout'], at: Point): number {
  return items.filter(other => {
    const box = other.getBoundingClientRect();
    return isBefore(layout, middle(box), box, at);
  }).length;
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
  const { layout = 'vertical', lockAxis = false, anchor = 'middle' } = options;
  const start = item.getBoundingClientRect();
  // Where the item was grabbed, so it does not jump under the pointer
  const grab = { x: event.clientX - start.left, y: event.clientY - start.top };
  const shift = { x: 0, y: 0 };
  let last: Point = { x: event.clientX, y: event.clientY };
  /** Another list the item is over now, and its position there */
  let other: { list: SortList; to: number } | null = null;
  let marker: HTMLElement | null = null;
  item.classList.add(DRAGGING);
  // Between lists the item would leave its list, and a list that scrolls would cut it off: a copy is seen instead
  const copy = options.lists ? dragCopy(item) : null;
  const visibility = item.style.visibility;
  if (copy) item.style.visibility = 'hidden';

  /** Moves the item under the pointer: its place in the layout plus a shift by transform. */
  const follow = (): void => {
    const box = item.getBoundingClientRect();
    const place = { x: box.left - shift.x, y: box.top - shift.y };
    shift.x = lockAxis && layout === 'vertical' ? 0 : last.x - grab.x - place.x;
    shift.y = lockAxis && layout === 'horizontal' ? 0 : last.y - grab.y - place.y;
    item.style.transform = `translate(${shift.x}px, ${shift.y}px)`;
    if (copy) Object.assign(copy.style, { left: `${place.x + shift.x}px`, top: `${place.y + shift.y}px` });
  };

  /** The point compared with the middles of the other items. */
  const at = (): Point => (anchor === 'pointer' ? last : middle(item.getBoundingClientRect()));

  /** The innermost list under the pointer: its own ('home'), another one, or null when over none. */
  const listUnder = (pointer: Point): SortList | 'home' | null => {
    const lists = (options.lists?.() ?? []).filter(list => !item.contains(list.element));
    for (const element of document.elementsFromPoint?.(pointer.x, pointer.y) ?? []) {
      if (item.contains(element)) continue;
      if (element === options.list) return 'home';
      const list = lists.find(candidate => candidate.element === element);
      if (list) return list;
    }
    return null;
  };

  /** Marks another list and draws a line where the item would go, or removes both. */
  const mark = (next: { list: SortList; to: number } | null): void => {
    if (other && other.list !== next?.list) other.list.element.classList.remove(DROP_TARGET);
    other = next;
    if (!next) {
      marker?.remove();
      marker = null;
      return;
    }
    next.list.element.classList.add(DROP_TARGET);
    if (!marker) {
      marker = document.body.appendChild(Object.assign(document.createElement('div'), { className: MARKER }));
      // Above the copy of the item, which is in the top layer too
      toTopLayer(marker);
    }
    const items = next.list.items().filter(element => element !== item);
    const across = (next.list.layout ?? 'vertical') === 'horizontal';
    const area = next.list.element.getBoundingClientRect();
    const near = items[next.to] ?? items[next.to - 1];
    const box = near?.getBoundingClientRect();
    const edge = !box ? (across ? area.left : area.top)
      : next.to < items.length ? (across ? box.left : box.top) : (across ? box.right : box.bottom);
    Object.assign(marker.style, across
      ? { left: `${edge - 2}px`, top: `${box?.top ?? area.top}px`, width: '3px', height: `${box?.height ?? area.height}px` }
      : { left: `${box?.left ?? area.left}px`, top: `${edge - 2}px`, width: `${box?.width ?? area.width}px`, height: '3px' });
  };

  /** Moves the item under the pointer and to its place in the order. */
  const update = (pointer: Point): void => {
    last = pointer;
    follow();
    const target = options.lists ? listUnder(pointer) : 'home';
    if (target && target !== 'home') {
      const items = target.items().filter(element => element !== item);
      return mark({ list: target, to: positionAmong(items, target.layout, at()) });
    }
    mark(null);
    // Out of all lists: nothing is marked, letting go there changes nothing and the item returns
    if (!target) return;

    const items = options.items();
    const others = items.filter(element => element !== item);
    const before = positionAmong(others, layout, at());
    if (before === items.indexOf(item)) return;

    // The others slide from their old places to the new ones (FLIP)
    const old = new Map(others.map(element => [element, element.getBoundingClientRect()]));
    options.move(before);
    follow();
    for (const element of others) {
      const was = old.get(element)!;
      const now = element.getBoundingClientRect();
      if (was.left !== now.left || was.top !== now.top) slide(element, { x: was.left - now.left, y: was.top - now.top });
    }
  };

  followPointer(event, item, {
    move: update,
    // Also a cancelled dragging keeps the new order: the item has moved in the data all along
    end: cancelled => {
      const dropped = other;
      mark(null);
      item.classList.remove(DRAGGING);
      item.style.transform = '';
      copy?.remove();
      if (copy) item.style.visibility = visibility;
      if (dropped && !cancelled) {
        // Into another list: its template makes the element there
        dropped.list.drop(dropped.to);
      } else if (shift.x || shift.y) {
        // The dropped item settles in its place instead of jumping there
        slide(item, shift);
      }
      options.done?.();
    },
  });
}
