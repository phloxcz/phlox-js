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
