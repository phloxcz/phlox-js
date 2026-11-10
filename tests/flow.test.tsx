import { describe, expect, test, vi } from 'vitest';
import { render } from '../src/dom';
import type { Child } from '../src/dom';
import { Else, ElseIf, For, If } from '../src/flow';
import { state } from '../src/reactive';

function mount(view: () => Child): HTMLElement {
  const root = document.createElement('div');
  render(view, root);
  return root;
}

describe('If', () => {
  test('a hidden branch is neither in DOM nor created', () => {
    const show = state(false);
    const body = vi.fn();
    const Profile = () => {
      body();
      return <b>profile</b>;
    };
    const root = mount(() => (
      <section>
        <If when={show}>
          <Profile />
        </If>
      </section>
    ));
    expect(root.querySelector('b')).toBeNull();
    expect(body).not.toHaveBeenCalled();

    show.set(true);
    expect(root.querySelector('b')).not.toBeNull();
    expect(body).toHaveBeenCalledTimes(1);

    show.set(false);
    expect(root.querySelector('b')).toBeNull();
  });

  test('showing again creates a fresh instance', () => {
    const show = state(true);
    const root = mount(() => <If when={show}><input /></If>);
    const first = root.querySelector('input');
    show.set(false);
    show.set(true);
    expect(root.querySelector('input')).not.toBeNull();
    expect(root.querySelector('input')).not.toBe(first);
  });

  test('Else', () => {
    const show = state(false);
    const yes = vi.fn(() => <b>yes</b>);
    const no = vi.fn(() => <i>no</i>);
    const Yes = () => yes();
    const No = () => no();
    const root = mount(() => (
      <If when={show}>
        <Yes />
      <Else />
        <No />
      </If>
    ));
    expect(yes).not.toHaveBeenCalled();
    expect(root.textContent).toBe('no');
    show.set(true);
    expect(root.textContent).toBe('yes');
    expect(root.querySelector('i')).toBeNull();
    expect(no).toHaveBeenCalledTimes(1);
  });

  test('ElseIf: the first truthy branch wins, later conditions are not read', () => {
    const a = state(false);
    const b = state(false);
    const readB = vi.fn(() => b());
    const root = mount(() => (
      <If when={a}>
        A<b>a</b>
      <ElseIf when={readB} />
        B
      <ElseIf when={() => true} />
        C
      <Else />
        never
      </If>
    ));
    expect(root.textContent).toBe('C');
    b.set(true);
    expect(root.textContent).toBe('B');
    a.set(true);
    expect(root.textContent).toBe('Aa');
    readB.mockClear();
    b.set(false);
    expect(readB).not.toHaveBeenCalled();
    a.set(false);
    expect(root.textContent).toBe('C');
  });

  test('nothing is shown without Else', () => {
    const a = state(false);
    const root = mount(() => <p><If when={a}>A<ElseIf when={a} />B</If></p>);
    expect(root.querySelector('p')!.textContent).toBe('');
  });

  test('a switch between other branches does not rebuild the shown one', () => {
    const a = state(1);
    const root = mount(() => <If when={a}><input /><Else />no</If>);
    const input = root.querySelector('input');
    a.set(2);
    expect(root.querySelector('input')).toBe(input);
  });

  test('misplaced Else and ElseIf are reported', () => {
    const on = state(true);
    expect(() => mount(() => <div><Else /></div>)).toThrow('only directly inside <If>');
    expect(() => mount(() => <div><ElseIf when={on} /></div>)).toThrow('only directly inside <If>');
    expect(() => mount(() => <If when={on}>a<Else />b<Else />c</If>)).toThrow('must be the last branch');
    expect(() => mount(() => <If when={on}>a<Else />b<ElseIf when={on} />c</If>)).toThrow('must be the last branch');
  });

  test('reactive text directly inside a branch', () => {
    const count = state(1);
    const root = mount(() => <If when={count}>{() => count() * 2}</If>);
    count.set(2);
    expect(root.textContent).toBe('4');
  });

  test('a change of the value alone does not rebuild the branch', () => {
    const count = state(1);
    const branch = vi.fn((value: () => number) => <b>{value}</b>);
    const root = mount(() => <If when={count}>{branch}</If>);
    const element = root.querySelector('b');
    count.set(2);
    expect(branch).toHaveBeenCalledTimes(1);
    expect(root.querySelector('b')).toBe(element);
    expect(root.textContent).toBe('2');
  });

  test('a child reading the value does not run with an empty value (zombie child)', () => {
    const user = state<{ name: string } | null>({ name: 'A' });
    const root = mount(() => <If when={user}>{u => <b>{() => u().name}</b>}</If>);
    expect(() => user.set(null)).not.toThrow();
    expect(root.textContent).toBe('');
  });

  test('a hidden branch is cleaned up', () => {
    const show = state(true);
    const count = state(0);
    const read = vi.fn(() => count());
    mount(() => <If when={show}><b>{read}</b></If>);
    show.set(false);
    read.mockClear();
    count.set(1);
    expect(read).not.toHaveBeenCalled();
  });
});

describe('For', () => {
  const list = (root: Element) => [...root.querySelectorAll('li')];
  const names = (root: Element) => list(root).map(li => li.textContent);

  function setup(initial: string[]) {
    const items = state(initial);
    const created = vi.fn();
    const root = mount(() => (
      <ul>
        <For each={items}>
          {item => {
            created(item);
            return <li>{item}</li>;
          }}
        </For>
      </ul>
    ));
    return { items, created, root };
  }

  test('renders and keeps the position among siblings', () => {
    const items = state(['a']);
    const root = mount(() => <ul><li>first</li><For each={items}>{i => <li>{i}</li>}</For><li>last</li></ul>);
    items.set(['a', 'b']);
    expect(names(root)).toEqual(['first', 'a', 'b', 'last']);
  });

  test('append, prepend and remove keep existing rows', () => {
    const { items, created, root } = setup(['a', 'b']);
    const [a, b] = list(root);
    created.mockClear();

    items.set(['z', 'a', 'b', 'c']);
    expect(names(root)).toEqual(['z', 'a', 'b', 'c']);
    expect(list(root)[1]).toBe(a);
    expect(list(root)[2]).toBe(b);
    expect(created.mock.calls.map(c => c[0])).toEqual(['z', 'c']);

    created.mockClear();
    items.set(['a', 'c']);
    expect(names(root)).toEqual(['a', 'c']);
    expect(list(root)[0]).toBe(a);
    expect(created).not.toHaveBeenCalled();
  });

  test('reorder moves the same nodes', () => {
    const { items, created, root } = setup(['a', 'b', 'c', 'd']);
    const nodes = new Map(list(root).map(li => [li.textContent, li]));
    created.mockClear();
    items.set(['d', 'b', 'a', 'c']);
    expect(names(root)).toEqual(['d', 'b', 'a', 'c']);
    expect(created).not.toHaveBeenCalled();
    for (const li of list(root)) expect(li).toBe(nodes.get(li.textContent));
  });

  test.each([
    ['first to end', ['b', 'c', 'd', 'e', 'a'], 1],
    ['last to front', ['e', 'a', 'b', 'c', 'd'], 1],
    ['swap of two', ['a', 'd', 'c', 'b', 'e'], 2],
    ['no change of order', ['a', 'b', 'c', 'd', 'e'], 0],
  ])('moves only the rows that must move: %s', (_name, order, moved) => {
    const { items, root } = setup(['a', 'b', 'c', 'd', 'e']);
    const observer = new MutationObserver(() => {});
    observer.observe(root.querySelector('ul')!, { childList: true });
    items.set([...order]);
    const added = observer.takeRecords().reduce((sum, record) => sum + record.addedNodes.length, 0);
    observer.disconnect();
    expect(names(root)).toEqual(order);
    expect(added).toBe(moved);
  });

  test('empty and back', () => {
    const { items, root } = setup(['a', 'b']);
    items.set([]);
    expect(list(root)).toHaveLength(0);
    items.set(['c']);
    expect(names(root)).toEqual(['c']);
  });

  test('duplicate items', () => {
    const { items, root } = setup(['a', 'a', 'b']);
    items.set(['a', 'b', 'a', 'a']);
    expect(names(root)).toEqual(['a', 'b', 'a', 'a']);
    items.set(['a']);
    expect(names(root)).toEqual(['a']);
  });

  test('random changes always end in the right order', () => {
    let seed = 1;
    const random = (max: number) => { seed = (seed * 16807) % 2147483647; return seed % max; };
    const { items, root } = setup([]);
    for (let round = 0; round < 200; round++) {
      const next = Array.from({ length: random(12) }, () => String(random(8)));
      items.set(next);
      expect(names(root)).toEqual(next);
    }
  });

  test('index follows the row', () => {
    const items = state(['a', 'b']);
    const root = mount(() => <ul><For each={items}>{(item, index) => <li>{index}:{item}</li>}</For></ul>);
    items.set(['b', 'a']);
    expect(names(root)).toEqual(['0:b', '1:a']);
  });

  test('a removed row is cleaned up, the others stay live', () => {
    const items = state(['a', 'b']);
    const count = state(0);
    const reads = new Map<string, number>();
    const root = mount(() => (
      <ul>
        <For each={items}>
          {item => <li>{() => { reads.set(item, (reads.get(item) ?? 0) + 1); return count(); }}</li>}
        </For>
      </ul>
    ));
    items.set(['b']);
    reads.clear();
    count.set(1);
    expect(reads.has('a')).toBe(false);
    expect(reads.get('b')).toBe(1);
    expect(names(root)).toEqual(['1']);
  });

  test('rows made of several nodes and growing regions move as a whole', () => {
    const items = state(['a', 'b']);
    const extra = state(false);
    const root = mount(() => (
      <div>
        <For each={items}>
          {item => <><b>{item}</b><If when={extra}><i>{item}</i></If></>}
        </For>
      </div>
    ));
    extra.set(true);
    items.set(['b', 'a']);
    expect(root.textContent).toBe('bbaa');
    items.set(['a']);
    expect(root.textContent).toBe('aa');
    expect(root.querySelectorAll('i')).toHaveLength(1);
  });

  test('nested lists', () => {
    const groups = state([{ name: 'x', items: state(['1']) }]);
    const root = mount(() => (
      <div>
        <For each={groups}>
          {group => <section><For each={group.items}>{item => <b>{group.name}{item}</b>}</For></section>}
        </For>
      </div>
    ));
    groups()[0]!.items.set(['1', '2']);
    expect(root.textContent).toBe('x1x2');
    groups.set([]);
    expect(root.querySelectorAll('section')).toHaveLength(0);
  });

  describe('with key', () => {
    interface Row { id: number; name: string }

    test('a new object with the same key keeps DOM and updates the row', () => {
      const items = state<Row[]>([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);
      const created = vi.fn();
      const root = mount(() => (
        <ul>
          <For each={items} key={row => row.id}>
            {row => {
              created();
              return <li>{() => row().name}</li>;
            }}
          </For>
        </ul>
      ));
      const [first, second] = [...root.querySelectorAll('li')];
      items.set([{ id: 2, name: 'B' }, { id: 1, name: 'A' }]);
      const after = [...root.querySelectorAll('li')];
      expect(created).toHaveBeenCalledTimes(2);
      expect(after[0]).toBe(second);
      expect(after[1]).toBe(first);
      expect(after.map(li => li.textContent)).toEqual(['B', 'A']);
    });
  });
});
