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
export const DRAGGING = 'phlox-dragging';

/** How long the other items slide and the dropped one settles, in ms. */
const SLIDE = 150;
/** How close to the edge the pointer must be to scroll, and the fastest scrolling, in px per frame. */
const EDGE = 48;
const SPEED = 16;

interface Point { x: number; y: number }

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
 */
export function dragToSort(event: PointerEvent, item: HTMLElement, options: SortOptions): void {
  if (event.button !== 0) return;
  event.preventDefault();
  const { layout = 'vertical', lockAxis = false } = options;
  const pointer = event.pointerId;
  const start = item.getBoundingClientRect();
  // Where the item was grabbed, so it does not jump under the pointer
  const grab = { x: event.clientX - start.left, y: event.clientY - start.top };
  const shift = { x: 0, y: 0 };
  let last = { x: event.clientX, y: event.clientY };
  const scroller = scrollerOf(item);
  // Limits taken before dragging: the shifted item makes the content larger, it would scroll on without end
  const max = { x: scroller.scrollWidth - scroller.clientWidth, y: scroller.scrollHeight - scroller.clientHeight };
  let frame = 0;
  item.classList.add(DRAGGING);

  /** Moves the item under the pointer: its place in the layout plus a shift by transform. */
  const follow = (): void => {
    const box = item.getBoundingClientRect();
    const place = { x: box.left - shift.x, y: box.top - shift.y };
    shift.x = lockAxis && layout === 'vertical' ? 0 : last.x - grab.x - place.x;
    shift.y = lockAxis && layout === 'horizontal' ? 0 : last.y - grab.y - place.y;
    item.style.transform = `translate(${shift.x}px, ${shift.y}px)`;
  };

  // Listened on the window and not with setPointerCapture() on the handle: moving the item in the DOM
  // releases the capture, and the rest of the dragging would get lost.
  const onMove = (move: PointerEvent): void => {
    if (move.pointerId !== pointer) return;
    last = { x: move.clientX, y: move.clientY };
    update();
  };

  /** Moves the item under the pointer and to its place in the order. */
  const update = (): void => {
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
      const by = { x: was.left - now.left, y: was.top - now.top };
      if (by.x || by.y) slide(other, by);
    }
  };

  // Near an edge the list scrolls, faster the closer the pointer is. The item stays under the pointer.
  const scroll = (): void => {
    const area = scroller === document.scrollingElement
      ? { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth }
      : scroller.getBoundingClientRect();
    const was = { x: scroller.scrollLeft, y: scroller.scrollTop };
    scroller.scrollTop = Math.max(0, Math.min(max.y, was.y + speed(last.y, area.top, area.bottom)));
    scroller.scrollLeft = Math.max(0, Math.min(max.x, was.x + speed(last.x, area.left, area.right)));
    if (scroller.scrollTop !== was.y || scroller.scrollLeft !== was.x) update();
    frame = requestAnimationFrame(scroll);
  };

  const onEnd = (end: PointerEvent): void => {
    if (end.pointerId !== pointer) return;
    cancelAnimationFrame(frame);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
    item.classList.remove(DRAGGING);
    item.style.transform = '';
    // The dropped item settles in its place instead of jumping there
    if (shift.x || shift.y) slide(item, shift);
    options.done?.();
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
  frame = requestAnimationFrame(scroll);
}

/** The nearest element that scrolls the item: a scrolling list, a dialog, or the page. */
function scrollerOf(item: HTMLElement): Element {
  for (let parent = item.parentElement; parent; parent = parent.parentElement) {
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

/** Animates an element from a shift back to its place. */
function slide(element: HTMLElement, from: Point): void {
  element.animate?.(
    [{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: 'none' }],
    { duration: SLIDE, easing: 'ease-out' },
  );
}
