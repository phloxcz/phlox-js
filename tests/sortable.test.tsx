import { afterEach, expect, test, vi } from 'vitest';
import { For, dragToSort, render, state } from '../src/index';
import type { SortOptions } from '../src/index';

afterEach(() => document.body.replaceChildren());

/** A list ordered by dragging, as in the guide. `place` gives the box of the n-th item in a fixed layout. */
function sortable(names: string[], place: (index: number) => { left: number; top: number }, options: Partial<SortOptions> = {}) {
  const cards = state(names);
  const done = vi.fn();
  let list!: HTMLElement;
  const root = document.createElement('div');
  document.body.append(root);
  render(() => (
    <ul ref={el => { list = el; }}>
      <For each={cards}>
        {card => {
          let element: HTMLElement;
          return (
            <li ref={el => { element = el; }}>
              <span class="handle" onPointerdown={event => dragToSort(event, element, {
                items: () => [...list.children] as HTMLElement[],
                move: to => cards.update(all => {
                  const rest = all.filter(other => other !== card);
                  rest.splice(to, 0, card);
                  return rest;
                }),
                done,
                ...options,
              })}>⠿</span>
              {card}
            </li>
          );
        }}
      </For>
    </ul>
  ), root);

  // Items 20 × 20 px. Like in a browser the box includes the shift by transform.
  const items = [...list.children] as HTMLElement[];
  items.forEach((item, index) => {
    item.getBoundingClientRect = () => {
      const [x = 0, y = 0] = (/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(item.style.transform) ?? []).slice(1).map(Number);
      const { left, top } = place(index);
      return new DOMRect(left + x, top + y, 20, 20);
    };
  });
  const handle = (index: number) => items[index]!.querySelector('.handle')!;
  const pointer = (target: EventTarget, type: string, x: number, y: number, button = 0) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button }));
  return { cards, done, items, list, handle, pointer };
}

test('one under another: the item follows the pointer freely, the order goes by the vertical position', () => {
  const { cards, done, items, list, handle, pointer } = sortable(['A', 'B', 'C'], index => ({ left: 0, top: index * 20 }));

  // Only the main button starts dragging
  pointer(handle(2), 'pointerdown', 10, 50, 2);
  pointer(document.body, 'pointermove', 10, 0);
  expect(cards()).toEqual(['A', 'B', 'C']);

  pointer(handle(2), 'pointerdown', 10, 50);
  pointer(document.body, 'pointermove', 40, 5);
  expect(cards()).toEqual(['C', 'A', 'B']);
  expect(list.textContent).toBe('⠿C⠿A⠿B');
  // Grabbed 10 px from its top left corner; in the mock layout its place is still 0, 40
  expect(items[2]!.style.transform).toBe('translate(30px, -45px)');
  expect(items[2]!.classList.contains('phlox-dragging')).toBe(true);
  expect(done).not.toHaveBeenCalled();

  pointer(document.body, 'pointerup', 40, 5);
  expect(done).toHaveBeenCalledOnce();
  expect(items[2]!.classList.contains('phlox-dragging')).toBe(false);
  expect(items[2]!.style.transform).toBe('');
});

test('lockAxis keeps the item on the line of the list', () => {
  const { items, handle, pointer } = sortable(['A', 'B', 'C'], index => ({ left: 0, top: index * 20 }), { lockAxis: true });
  pointer(handle(0), 'pointerdown', 10, 10);
  pointer(document.body, 'pointermove', 60, 15);
  expect(items[0]!.style.transform).toBe('translate(0px, 5px)');
});

test('side by side: the order goes by the horizontal position', () => {
  const { cards, handle, pointer } = sortable(['A', 'B', 'C'], index => ({ left: index * 20, top: 0 }), { layout: 'horizontal' });
  pointer(handle(0), 'pointerdown', 10, 10);
  pointer(document.body, 'pointermove', 35, 30);
  expect(cards()).toEqual(['B', 'A', 'C']);
  pointer(document.body, 'pointermove', 55, 10);
  expect(cards()).toEqual(['B', 'C', 'A']);
  pointer(document.body, 'pointerup', 55, 10);
});

test('in wrapping rows: the order of reading, row by row', () => {
  // Two items in a row: A B / C D
  const { cards, handle, pointer } = sortable(['A', 'B', 'C', 'D'], index => ({ left: (index % 2) * 20, top: Math.floor(index / 2) * 20 }), { layout: 'grid' });
  pointer(handle(0), 'pointerdown', 10, 10);
  // Onto D: after B, C and D
  pointer(document.body, 'pointermove', 32, 31);
  expect(cards()).toEqual(['B', 'C', 'D', 'A']);
  // Back to the first row between A's old place and B
  pointer(document.body, 'pointermove', 15, 10);
  expect(cards()).toEqual(['A', 'B', 'C', 'D']);
  pointer(document.body, 'pointerup', 15, 10);
});

test('near an edge the nearest scrolling element scrolls, and the item keeps its place in the order', () => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  try {
    // A list of 10 items 20 px high in a box 100 px high that scrolls
    let scrolled = 0;
    const { cards, items, list, handle, pointer } = sortable('ABCDEFGHIJ'.split(''), index => ({ left: 0, top: index * 20 - scrolled }));
    const box = list.parentElement!;
    box.style.overflowY = 'auto';
    Object.defineProperties(box, {
      scrollHeight: { value: 200 },
      clientHeight: { value: 100 },
      // Like a browser while the shifted item overflows: it would let it scroll further
      scrollTop: { get: () => scrolled, set: (value: number) => { scrolled = Math.max(0, Math.min(500, value)); } },
    });
    box.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100);

    pointer(handle(0), 'pointerdown', 10, 10);
    pointer(document.body, 'pointermove', 10, 50);
    vi.advanceTimersToNextFrame();
    expect(scrolled).toBe(0);
    expect(cards().indexOf('A')).toBe(1);

    // At the bottom edge: it scrolls frame by frame, the item goes along
    pointer(document.body, 'pointermove', 10, 95);
    for (let frame = 0; frame < 10; frame++) vi.advanceTimersToNextFrame();
    expect(scrolled).toBe(100);
    expect(cards().indexOf('A')).toBe(9);
    expect(items[0]!.getBoundingClientRect().top).toBe(85);

    // Back at the top edge it scrolls back; after letting go it stops
    pointer(document.body, 'pointermove', 10, 5);
    vi.advanceTimersToNextFrame();
    const after = scrolled;
    expect(after).toBeLessThan(100);
    pointer(document.body, 'pointerup', 10, 5);
    vi.advanceTimersToNextFrame();
    expect(scrolled).toBe(after);
  } finally {
    vi.useRealTimers();
  }
});

/** Two lists side by side, 0–100 and 100–200 px, nothing right of them; items 20 px high one under another. jsdom has no elementsFromPoint. */
function twoLists() {
  const make = (left: number, names: string[]) => {
    const list = document.createElement('ul');
    list.getBoundingClientRect = () => new DOMRect(left, 0, 100, 200);
    for (const [index, name] of names.entries()) {
      const element = document.createElement('li');
      element.textContent = name;
      element.getBoundingClientRect = () => {
        const [x = 0, y = 0] = (/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(element.style.transform) ?? []).slice(1).map(Number);
        return new DOMRect(left + x, index * 20 + y, 100, 20);
      };
      list.append(element);
    }
    document.body.append(list);
    return list;
  };
  const home = make(0, ['A', 'B']);
  const other = make(100, ['X', 'Y', 'Z']);
  // A list inside the dragged item A: the item cannot go into itself
  const inner = document.createElement('ul');
  home.children[0]!.append(inner);
  // Right of both lists (from 200 px) there is no list
  document.elementsFromPoint = (x: number) => (x < 100 ? [inner, home, document.body] : x < 200 ? [other, document.body] : [document.body]);
  const pointer = (type: string, x: number, y: number) =>
    document.body.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
  return { home, other, inner, pointer };
}

test('lists: over another list the item stays in its data, the list is marked, letting go drops it at the place', () => {
  const { home, other, inner, pointer } = twoLists();
  const move = vi.fn();
  const drop = vi.fn();
  const innerDrop = vi.fn();
  const item = home.children[0] as HTMLElement;
  const start = (x: number, y: number) => item.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
  const options: SortOptions = {
    items: () => [...home.children] as HTMLElement[],
    move,
    list: home,
    lists: () => [
      { element: other, items: () => [...other.children] as HTMLElement[], drop },
      { element: inner, items: () => [], drop: innerDrop },
    ],
  };
  item.addEventListener('pointerdown', event => dragToSort(event, item, options));

  start(10, 10);
  // Over the other list between X and Y: grabbed 10 px from the top, so the middle of the item is at 35
  pointer('pointermove', 150, 25);
  expect(move).not.toHaveBeenCalled();
  expect(other.classList.contains('phlox-drop-target')).toBe(true);
  // A copy on <body> follows the pointer, so no scrolling list cuts it off; the item waits hidden in its place
  const copy = document.querySelector<HTMLElement>('body > .phlox-drag-copy')!;
  expect(copy.textContent).toBe('A');
  expect(copy.style.position).toBe('fixed');
  expect([copy.style.left, copy.style.top]).toEqual(['140px', '15px']);
  expect(copy.inert).toBe(true);
  expect(item.style.visibility).toBe('hidden');
  const marker = document.querySelector<HTMLElement>('.phlox-drop-marker')!;
  expect(marker.style.top).toBe('18px');
  expect(marker.style.width).toBe('100px');
  // Back over its own list below B: the mark and the line go, ordering works as before
  pointer('pointermove', 10, 45);
  expect(other.classList.contains('phlox-drop-target')).toBe(false);
  expect(document.querySelector('.phlox-drop-marker')).toBeNull();
  expect(move).toHaveBeenCalledWith(1);
  // Over the other list again, below its last item, and let go
  pointer('pointermove', 150, 90);
  pointer('pointerup', 150, 90);
  expect(drop).toHaveBeenCalledWith(3);
  expect(innerDrop).not.toHaveBeenCalled();
  expect(other.classList.contains('phlox-drop-target')).toBe(false);
  expect(document.querySelector('.phlox-drop-marker')).toBeNull();
  expect(item.style.transform).toBe('');
  expect(document.querySelector('.phlox-drag-copy')).toBeNull();
  expect(item.style.visibility).toBe('');

  // Escape over another list drops nothing
  start(10, 10);
  pointer('pointermove', 150, 25);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(drop).toHaveBeenCalledOnce();

  // Out of all lists after another one: the mark goes, letting go there drops nothing and orders nothing
  start(10, 10);
  pointer('pointermove', 150, 25);
  pointer('pointermove', 300, 25);
  expect(other.classList.contains('phlox-drop-target')).toBe(false);
  expect(document.querySelector('.phlox-drop-marker')).toBeNull();
  pointer('pointerup', 300, 25);
  expect(drop).toHaveBeenCalledOnce();
  expect(move).toHaveBeenCalledOnce();
});

test('anchor pointer: the pointer decides, not the middle of the item, for items of different sizes', () => {
  // Side by side: A 20 px, B 20 px, C 20 px; C is grabbed at its left edge
  const { cards, handle, pointer } = sortable(['A', 'B', 'C'], index => ({ left: index * 20, top: 0 }), { layout: 'horizontal', anchor: 'pointer' });
  pointer(handle(2), 'pointerdown', 41, 10);
  // The pointer left of the middle of A: C goes first, though the middle of C would still be right of it
  pointer(document.body, 'pointermove', 8, 10);
  expect(cards()).toEqual(['C', 'A', 'B']);
  pointer(document.body, 'pointerup', 8, 10);
});
