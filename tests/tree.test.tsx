import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BootstrapTheme, Container, Presenter, render } from '../src/index';
import type { Child } from '../src/index';
import { Tree, TreeView } from '../src/components/index';
import type { TreeMove, TreeNode } from '../src/components/index';
import { Form, FormView } from '../src/forms/index';
import { boot, tick } from './helpers';

const NODES: TreeNode<number>[] = [
  { id: 1, label: 'Ovoce', children: [{ id: 11, label: 'Jablka' }, { id: 12, label: 'Hrušky', children: [{ id: 121, label: 'Williams' }] }] },
  { id: 2, label: 'Zelenina', children: [{ id: 21, label: 'Mrkev' }] },
  { id: 3, label: 'Pečivo' },
];

/** The same tree loaded level by level, like from a server. */
function lazy() {
  const byParent = new Map<number | null, TreeNode<number>[]>();
  const walk = (nodes: TreeNode<number>[], parent: number | null) => {
    byParent.set(parent, nodes.map(({ children, ...node }) => ({ ...node, hasChildren: Boolean(children?.length) })));
    for (const node of nodes) if (node.children) walk(node.children, node.id);
  };
  walk(NODES, null);
  const load = vi.fn(async (parent: TreeNode<number> | null) => byParent.get(parent?.id ?? null) ?? []);
  const path = vi.fn(async (id: number) => ({ 121: [1, 12], 12: [1], 11: [1], 21: [2] } as Record<number, number[]>)[id] ?? []);
  return { load, path };
}

function mount(view: () => Child) {
  const root = document.createElement('div');
  document.body.append(root);
  render(view, root);
  return root;
}

const labels = (root: ParentNode) => [...root.querySelectorAll('.pt-label')].map(label => label.textContent);
const itemOf = (root: ParentNode, label: string) =>
  [...root.querySelectorAll<HTMLElement>('.pt-item')].find(item => item.querySelector(':scope > .pt-row .pt-label')!.textContent === label)!;
const key = (target: Element, name: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));

beforeEach(() => localStorage.clear());
afterEach(() => document.body.replaceChildren());

describe('the model', () => {
  test('nodes at once: expanding shows the children, find and visible', async () => {
    const tree = new Tree({ nodes: NODES });
    expect(tree.visible().map(item => item.id)).toEqual([1, 2, 3]);
    await tree.expand(tree.find(1)!);
    await tree.expand(tree.find(12)!);
    expect(tree.visible().map(item => item.id)).toEqual([1, 11, 12, 121, 2, 3]);
    expect(tree.find(3)!.hasChildren()).toBe(false);
    tree.collapse(tree.find(1)!);
    expect(tree.visible().map(item => item.id)).toEqual([1, 2, 3]);
  });

  test('level by level: the top level, then children when a node is expanded', async () => {
    const { load } = lazy();
    const tree = new Tree({ load });
    await tree.load();
    await tree.load();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(null);
    const fruit = tree.find(1)!;
    expect(fruit.children()).toBeNull();
    expect(fruit.hasChildren()).toBe(true);
    const expanding = tree.expand(fruit);
    expect(fruit.loading()).toBe(true);
    await expanding;
    expect(fruit.loading()).toBe(false);
    expect(load).toHaveBeenLastCalledWith(NODES[0] && expect.objectContaining({ id: 1 }));
    expect(tree.visible().map(item => item.id)).toEqual([1, 11, 12, 2, 3]);
    // A leaf is never loaded
    await tree.expand(tree.find(3)!);
    expect(load).toHaveBeenCalledTimes(2);
  });

  test('select() from code loads and expands the way to a node, with `path`', async () => {
    const { load, path } = lazy();
    const tree = new Tree({ load, path });
    const chosen = vi.fn();
    tree.onSelect = chosen;
    await tree.select(121);
    expect(path).toHaveBeenCalledWith(121);
    expect(tree.selected()).toBe(121);
    expect(tree.visible().map(item => item.id)).toEqual([1, 11, 12, 121, 2, 3]);
    // Only the user calls onSelect, so a selection from the URL does not navigate again
    expect(chosen).not.toHaveBeenCalled();
    tree.choose(tree.find(21) ?? tree.find(2)!);
    expect(chosen).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });

  test('expanded nodes are remembered across page loads', async () => {
    const first = new Tree({ load: lazy().load, remember: 'categories' });
    await first.load();
    await first.expand(first.find(1)!);
    await first.expand(first.find(12)!);
    first.collapse(first.find(1)!);
    await first.expand(first.find(2)!);

    const { load } = lazy();
    const second = new Tree({ load, remember: 'categories' });
    await second.load();
    expect(second.visible().map(item => item.id)).toEqual([1, 2, 21, 3]);
    // Hrušky stay remembered under the collapsed Ovoce
    await second.expand(second.find(1)!);
    expect(second.visible().map(item => item.id)).toEqual([1, 11, 12, 121, 2, 21, 3]);
    const third = new Tree({ nodes: NODES, remember: 'categories' });
    await third.load();
    expect(third.visible().map(item => item.id)).toEqual([1, 11, 12, 121, 2, 21, 3]);
  });

  test('picking one or several nodes, not a disabled one', () => {
    const nodes = [...NODES, { id: 4, label: 'Vyřazené', disabled: true }];
    const single = new Tree({ nodes, pick: 'single' });
    single.check(single.find(2)!);
    single.check(single.find(3)!);
    single.check(single.find(4)!);
    expect(single.checked()).toEqual([3]);
    const multiple = new Tree({ nodes, pick: 'multiple' });
    multiple.check(multiple.find(2)!);
    multiple.check(multiple.find(3)!);
    multiple.check(multiple.find(2)!);
    expect(multiple.checked()).toEqual([3]);
  });

  test('moving: before, after, into; the new parent and index go to `move`', async () => {
    const moves: TreeMove<TreeNode<number>>[] = [];
    const tree = new Tree({ nodes: NODES, move: move => void moves.push(move) });
    const ids = (items = tree.roots()) => items.map(item => item.id);

    expect(await tree.move(tree.find(3)!, tree.find(1)!, 'before')).toBe(true);
    expect(ids()).toEqual([3, 1, 2]);
    expect(moves.at(-1)).toMatchObject({ node: { id: 3 }, target: { id: 1 }, position: 'before', parent: null, index: 0 });

    expect(await tree.move(tree.find(11)!, tree.find(2)!, 'after')).toBe(true);
    expect(ids()).toEqual([3, 1, 2, 11]);
    expect(ids(tree.find(1)!.children()!)).toEqual([12]);
    expect(tree.find(11)!.parent()).toBeNull();

    // Into a leaf: it becomes a branch and opens
    expect(await tree.move(tree.find(1)!, tree.find(3)!, 'child')).toBe(true);
    expect(ids()).toEqual([3, 2, 11]);
    expect(tree.find(3)!.hasChildren()).toBe(true);
    expect(tree.find(3)!.expanded()).toBe(true);
    expect(moves.at(-1)).toMatchObject({ node: { id: 1 }, position: 'child', parent: { id: 3 }, index: 0 });
    expect(tree.find(121)!.ancestors().map(item => item.id)).toEqual([3, 1, 12]);
  });

  test('moves that do nothing or break the tree are refused', async () => {
    const move = vi.fn();
    const tree = new Tree({ nodes: NODES, move });
    expect(await tree.move(tree.find(1)!, tree.find(1)!, 'after')).toBe(false);
    expect(await tree.move(tree.find(1)!, tree.find(121)!, 'child')).toBe(false);
    expect(await tree.move(tree.find(12)!, tree.find(1)!, 'child')).toBe(false);
    expect(await tree.move(tree.find(1)!, tree.find(2)!, 'before')).toBe(false);
    expect(await tree.move(tree.find(2)!, tree.find(1)!, 'after')).toBe(false);
    expect(move).not.toHaveBeenCalled();
  });

  test('when saving fails, the node goes back and the error goes on', async () => {
    const tree = new Tree({ nodes: NODES, move: async () => { throw new Error('Server says no.'); } });
    await expect(tree.move(tree.find(11)!, tree.find(3)!, 'child')).rejects.toThrow('Server says no.');
    expect(tree.find(1)!.children()!.map(item => item.id)).toEqual([11, 12]);
    expect(tree.find(11)!.parent()!.id).toBe(1);
    expect(tree.find(3)!.hasChildren()).toBe(false);
  });

  test('moving into a node not loaded yet loads it first', async () => {
    const { load } = lazy();
    const tree = new Tree({ load });
    await tree.load();
    await tree.move(tree.find(3)!, tree.find(2)!, 'child');
    expect(tree.find(2)!.children()!.map(item => item.id)).toEqual([21, 3]);
  });
});

describe('the view', () => {
  test('the HTML of phloxcz/components-tree with the roles of a tree', async () => {
    const tree = new Tree({ nodes: NODES });
    await tree.expand(tree.find(1)!);
    const root = mount(() => <TreeView tree={tree} lines aria-label="Kategorie" />);
    expect(root.firstElementChild!.className).toBe('phlox-tree phlox-tree--lines');
    const list = root.querySelector('[role=tree]')!;
    expect(list.getAttribute('aria-label')).toBe('Kategorie');
    expect(labels(root)).toEqual(['Ovoce', 'Jablka', 'Hrušky', 'Zelenina', 'Pečivo']);

    const fruit = itemOf(root, 'Ovoce');
    expect(fruit.className).toBe('pt-item is-expanded has-children');
    expect(fruit.getAttribute('aria-expanded')).toBe('true');
    expect(fruit.getAttribute('aria-level')).toBe('1');
    expect(fruit.querySelector(':scope > .pt-children > [role=group]')).not.toBeNull();
    const pears = itemOf(root, 'Hrušky');
    expect(pears.className).toBe('pt-item has-children is-last');
    expect(pears.getAttribute('aria-level')).toBe('2');
    expect(pears.getAttribute('aria-expanded')).toBe('false');
    expect(pears.querySelector('.pt-connector')!.className).toBe('pt-connector pt-connector--last');
    expect(itemOf(root, 'Pečivo').className).toBe('pt-item is-leaf is-last');
    expect(itemOf(root, 'Pečivo').hasAttribute('aria-expanded')).toBe(false);
    expect(itemOf(root, 'Pečivo').querySelector('.pt-toggle--leaf')).not.toBeNull();

    // Lines: the column under Hrušky goes on only when Hrušky have a sibling below; they are the last
    await tree.expand(tree.find(12)!);
    expect(itemOf(root, 'Williams').querySelector('.pt-indent')!.getAttribute('data-has-line')).toBe('0');
    await tree.move(tree.find(11)!, tree.find(12)!, 'after');
    expect(itemOf(root, 'Williams').querySelector('.pt-indent')!.getAttribute('data-has-line')).toBe('1');
  });

  test('a click on the arrow expands, a click on the row selects', async () => {
    const tree = new Tree({ nodes: [...NODES, { id: 4, label: 'Vyřazené', disabled: true }] });
    const chosen = vi.fn();
    tree.onSelect = chosen;
    const root = mount(() => <TreeView tree={tree} />);

    itemOf(root, 'Ovoce').querySelector<HTMLButtonElement>('.pt-toggle')!.click();
    await tick();
    expect(labels(root)).toEqual(['Ovoce', 'Jablka', 'Hrušky', 'Zelenina', 'Pečivo', 'Vyřazené']);
    expect(chosen).not.toHaveBeenCalled();
    expect(itemOf(root, 'Ovoce').querySelector('.pt-toggle')!.getAttribute('aria-label')).toBe('Collapse');

    itemOf(root, 'Jablka').querySelector<HTMLElement>('.pt-label')!.click();
    expect(tree.selected()).toBe(11);
    expect(chosen).toHaveBeenCalledWith(NODES[0]!.children![0]);
    expect(itemOf(root, 'Jablka').classList.contains('is-selected')).toBe(true);
    expect(itemOf(root, 'Jablka').getAttribute('aria-selected')).toBe('true');

    itemOf(root, 'Vyřazené').querySelector<HTMLElement>('.pt-row')!.click();
    expect(tree.selected()).toBe(11);
    expect(itemOf(root, 'Vyřazené').getAttribute('aria-disabled')).toBe('true');
  });

  test('the keyboard of the WAI-ARIA tree pattern, one node reachable by Tab', async () => {
    const tree = new Tree({ nodes: NODES });
    const root = mount(() => <TreeView tree={tree} />);
    const tabStops = () => [...root.querySelectorAll<HTMLElement>('.pt-item')].filter(item => item.tabIndex === 0);
    expect(tabStops().map(item => item.dataset.id)).toEqual(['1']);
    const active = () => (document.activeElement as HTMLElement).dataset.id;

    itemOf(root, 'Ovoce').focus();
    key(document.activeElement!, 'ArrowRight');
    await tick();
    expect(labels(root)).toContain('Jablka');
    key(document.activeElement!, 'ArrowRight');
    expect(active()).toBe('11');
    key(document.activeElement!, 'ArrowDown');
    expect(active()).toBe('12');
    expect(tabStops().map(item => item.dataset.id)).toEqual(['12']);
    key(document.activeElement!, 'ArrowLeft');
    expect(active()).toBe('1');
    key(document.activeElement!, 'ArrowLeft');
    expect(labels(root)).toEqual(['Ovoce', 'Zelenina', 'Pečivo']);
    key(document.activeElement!, 'End');
    expect(active()).toBe('3');
    key(document.activeElement!, 'ArrowUp');
    expect(active()).toBe('2');
    key(document.activeElement!, 'Home');
    expect(active()).toBe('1');

    // Letters jump to a node that starts with them, without diacritics; quickly typed ones make one text
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
    key(document.activeElement!, 'p');
    expect(active()).toBe('3');
    now.mockReturnValue(11_000);
    key(document.activeElement!, 'z');
    expect(active()).toBe('2');
    now.mockReturnValue(12_000);
    key(document.activeElement!, 'o');
    key(document.activeElement!, 'v');
    expect(active()).toBe('1');
    now.mockRestore();
    itemOf(root, 'Zelenina').focus();

    key(document.activeElement!, 'Enter');
    expect(tree.selected()).toBe(2);
    key(document.activeElement!, '*');
    await tick();
    expect(labels(root)).toEqual(['Ovoce', 'Jablka', 'Hrušky', 'Zelenina', 'Mrkev', 'Pečivo']);

    // Focusing the tree itself passes the focus on to its node
    root.querySelector<HTMLElement>('[role=tree]')!.focus();
    expect(active()).toBe('2');
  });

  test('links: the label is a link, Enter follows it', () => {
    const tree = new Tree({ nodes: NODES });
    const root = mount(() => <TreeView tree={tree} href={node => `/categories/${node.id}`} />);
    const link = itemOf(root, 'Pečivo').querySelector<HTMLAnchorElement>('a.pt-label')!;
    expect(link.getAttribute('href')).toBe('/categories/3');
    const followed = vi.fn((event: Event) => event.preventDefault());
    link.addEventListener('click', followed);
    itemOf(root, 'Pečivo').focus();
    key(document.activeElement!, 'Enter');
    expect(followed).toHaveBeenCalledOnce();
    expect(tree.selected()).toBe(3);
    // A click on the link itself is followed by the browser, the tree only selects
    link.click();
    expect(followed).toHaveBeenCalledTimes(2);
  });

  test('a node that fails to load reports the error and stays collapsed', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tree = new Tree<TreeNode>({ load: async parent => {
      if (parent) throw new Error('Offline.');
      return [{ id: 1, label: 'Ovoce', hasChildren: true }];
    } });
    const root = mount(() => <TreeView tree={tree} />);
    await tick();
    itemOf(root, 'Ovoce').querySelector<HTMLButtonElement>('.pt-toggle')!.click();
    await tick();
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Offline.' }));
    expect(itemOf(root, 'Ovoce').getAttribute('aria-expanded')).toBe('false');
    expect(itemOf(root, 'Ovoce').getAttribute('aria-busy')).toBeNull();
    error.mockRestore();
  });

  test('Bootstrap: the classes of phloxcz/components-tree', async () => {
    const tree = new Tree({ nodes: NODES });
    tree.selected.set(1);
    class Page extends Presenter {
      render() { return <TreeView tree={tree} />; }
    }
    const { element } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    expect(itemOf(element, 'Ovoce').querySelector('.pt-row')!.className).toBe('pt-row active');
    expect(itemOf(element, 'Ovoce').querySelector('.pt-toggle')!.className)
      .toBe('pt-toggle btn btn-sm btn-link p-0 border-0 text-reset text-decoration-none');
  });
});

describe('dragging', () => {
  /** Rows 20 px high one under another, in the order they are shown. */
  function layout(root: HTMLElement) {
    const rows = () => [...root.querySelectorAll<HTMLElement>('.pt-row')];
    for (const row of rows()) {
      row.getBoundingClientRect = () => new DOMRect(0, rows().indexOf(row) * 20, 200, 20);
    }
    document.elementFromPoint = (_x: number, y: number) => rows()[Math.floor(y / 20)] ?? null;
  }
  const pointer = (target: EventTarget, type: string, y: number) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: y, button: 0 }));

  test('a copy of the row follows the pointer, the place is shown, letting go moves the node', async () => {
    const move = vi.fn();
    const tree = new Tree({ nodes: NODES, draggable: true, move });
    const root = mount(() => <TreeView tree={tree} />);
    layout(root);
    const bread = itemOf(root, 'Pečivo');

    // Rows: Ovoce 0-20, Zelenina 20-40, Pečivo 40-60
    pointer(bread.querySelector('.pt-row')!, 'pointerdown', 50);
    pointer(document.body, 'pointermove', 51);
    expect(document.querySelector('.pt-ghost')).toBeNull();

    pointer(document.body, 'pointermove', 3);
    expect(document.querySelector('.pt-ghost')!.textContent).toBe('Pečivo');
    expect(bread.classList.contains('is-dragging')).toBe(true);
    expect(itemOf(root, 'Ovoce').getAttribute('data-drop-pos')).toBe('before');
    pointer(document.body, 'pointermove', 30);
    expect(itemOf(root, 'Ovoce').hasAttribute('data-drop-pos')).toBe(false);
    expect(itemOf(root, 'Zelenina').getAttribute('data-drop-pos')).toBe('child');

    pointer(document.body, 'pointerup', 30);
    await tick();
    expect(document.querySelector('.pt-ghost')).toBeNull();
    expect(move).toHaveBeenCalledWith(expect.objectContaining({ node: NODES[2], target: NODES[1], position: 'child', index: 1 }));
    expect(labels(root)).toEqual(['Ovoce', 'Zelenina', 'Mrkev', 'Pečivo']);
    expect(itemOf(root, 'Pečivo').getAttribute('aria-level')).toBe('2');
  });

  test('Escape cancels the dragging, a node cannot go into its own subtree', async () => {
    const move = vi.fn();
    const tree = new Tree({ nodes: NODES, draggable: node => node.id !== 2, move });
    await tree.expand(tree.find(1)!);
    const root = mount(() => <TreeView tree={tree} />);
    layout(root);

    // Rows: Ovoce 0, Jablka 20, Hrušky 40, Zelenina 60, Pečivo 80
    pointer(itemOf(root, 'Ovoce').querySelector('.pt-row')!, 'pointerdown', 10);
    pointer(document.body, 'pointermove', 30);
    expect(itemOf(root, 'Jablka').hasAttribute('data-drop-pos')).toBe(false);
    pointer(document.body, 'pointermove', 90);
    expect(itemOf(root, 'Pečivo').getAttribute('data-drop-pos')).toBe('child');
    key(document.body, 'Escape');
    expect(document.querySelector('.pt-ghost')).toBeNull();
    pointer(document.body, 'pointerup', 90);
    await tick();
    expect(move).not.toHaveBeenCalled();

    // A node that may not be dragged
    pointer(itemOf(root, 'Zelenina').querySelector('.pt-row')!, 'pointerdown', 70);
    pointer(document.body, 'pointermove', 10);
    expect(document.querySelector('.pt-ghost')).toBeNull();
    pointer(document.body, 'pointerup', 10);
  });
});

describe('addTreeSelect and addTreeMultiSelect', () => {
  interface Article {
    title: string;
    categoryId: number | null;
    tagIds: number[];
  }

  test('one id or a list of ids, picked by a click on the row', async () => {
    const form = new Form<Article>();
    const category = form.addTreeSelect('categoryId', 'Kategorie:', { nodes: NODES }).setRequired('Vyberte kategorii.');
    const tags = form.addTreeMultiSelect('tagIds', 'Štítky:', { nodes: NODES, lines: true });
    const root = mount(() => <FormView form={form} />);
    const [first, second] = [...root.querySelectorAll<HTMLElement>('.phlox-treeselect')];

    expect(form.getValues()).toEqual({ categoryId: null, tagIds: [] });
    expect(first!.querySelector('input')!.type).toBe('radio');
    expect(first!.querySelector('input')!.name).toBe('categoryId');
    expect(second!.querySelector('input')!.name).toBe('tagIds[]');
    expect(second!.querySelector('.phlox-tree--lines')).not.toBeNull();
    expect(first!.querySelector('[role=tree]')!.getAttribute('aria-label')).toBe('Kategorie');

    itemOf(first!, 'Zelenina').querySelector<HTMLElement>('.pt-label')!.click();
    itemOf(first!, 'Pečivo').querySelector<HTMLElement>('.pt-label')!.click();
    itemOf(second!, 'Zelenina').querySelector<HTMLElement>('.pt-label')!.click();
    itemOf(second!, 'Pečivo').querySelector<HTMLInputElement>('input')!.click();
    expect(category.getValue()).toBe(3);
    expect(tags.getValue()).toEqual([2, 3]);
    expect(itemOf(second!, 'Pečivo').getAttribute('aria-checked')).toBe('true');
    expect(itemOf(first!, 'Zelenina').querySelector('input')!.checked).toBe(false);
    expect(first!.querySelector('[role=tree]')!.hasAttribute('aria-multiselectable')).toBe(false);
    expect(second!.querySelector('[role=tree]')!.getAttribute('aria-multiselectable')).toBe('true');

    // Space picks too
    itemOf(second!, 'Pečivo').focus();
    key(document.activeElement!, ' ');
    expect(tags.getValue()).toEqual([2]);
  });

  test('required, checked live after an error, the focus goes to the tree', async () => {
    const form = new Form<Article>();
    const category = form.addTreeSelect('categoryId', 'Kategorie:', { nodes: NODES }).setRequired('Vyberte kategorii.');
    const root = mount(() => <FormView form={form} />);
    expect(await form.submit()).toBe(false);
    expect(category.errors()).toEqual(['Vyberte kategorii.']);
    expect(root.querySelector('.phlox-treeselect')!.classList.contains('phlox-invalid')).toBe(true);
    expect(root.querySelector('[role=tree]')!.getAttribute('aria-invalid')).toBe('true');
    expect((document.activeElement as HTMLElement).dataset.id).toBe('1');

    itemOf(root, 'Zelenina').querySelector<HTMLElement>('.pt-label')!.click();
    await tick();
    expect(category.errors()).toEqual([]);
  });

  test('a picked node deep in a lazy tree is shown', async () => {
    const { load, path } = lazy();
    const form = new Form<Article>();
    form.addTreeSelect('categoryId', 'Kategorie:', { load, path });
    form.setDefaults({ categoryId: 121 });
    const root = mount(() => <FormView form={form} />);
    await tick();
    expect(labels(root)).toEqual(['Ovoce', 'Jablka', 'Hrušky', 'Williams', 'Zelenina', 'Pečivo']);
    expect(itemOf(root, 'Williams').querySelector('input')!.checked).toBe(true);
    expect(itemOf(root, 'Williams').tabIndex).toBe(0);
  });

  test('types: one id for a single field, a list for several', () => {
    const form = new Form<Article>();
    const single: number | null = form.addTreeSelect('categoryId', '', { nodes: NODES }).getValue();
    const several: number[] = form.addTreeMultiSelect('tagIds', '', { nodes: NODES }).getValue();
    // @ts-expect-error title is not a list
    void (() => form.addTreeMultiSelect('title'));
    void single;
    void several;
  });
});

describe('a finger and animation', () => {
  function layout(root: HTMLElement) {
    const rows = () => [...root.querySelectorAll<HTMLElement>('.pt-row')];
    for (const row of rows()) row.getBoundingClientRect = () => new DOMRect(0, rows().indexOf(row) * 20, 200, 20);
    document.elementFromPoint = (_x: number, y: number) => rows()[Math.floor(y / 20)] ?? null;
  }
  const touch = (target: EventTarget, type: string, y: number) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: y, button: 0 });
    Object.defineProperty(event, 'pointerType', { value: 'touch' });
    return target.dispatchEvent(event);
  };

  test('a finger held on a node drags it, a swipe scrolls as usual', async () => {
    vi.useFakeTimers();
    try {
      const move = vi.fn();
      const tree = new Tree({ nodes: NODES, draggable: true, move });
      const root = mount(() => <TreeView tree={tree} />);
      layout(root);
      const bread = itemOf(root, 'Pečivo').querySelector('.pt-row')!;

      // A swipe: the finger moves before the time is up
      touch(bread, 'pointerdown', 50);
      touch(document.body, 'pointermove', 30);
      vi.advanceTimersByTime(500);
      expect(document.querySelector('.pt-ghost')).toBeNull();
      touch(document.body, 'pointerup', 30);

      // Held still: after a moment the node is dragged, without moving first
      touch(bread, 'pointerdown', 50);
      vi.advanceTimersByTime(399);
      expect(document.querySelector('.pt-ghost')).toBeNull();
      vi.advanceTimersByTime(1);
      expect(document.querySelector('.pt-ghost')).not.toBeNull();
      expect(itemOf(root, 'Pečivo').classList.contains('is-dragging')).toBe(true);
      // The page does not scroll under the finger, and no menu opens
      expect(window.dispatchEvent(new Event('touchmove', { cancelable: true }))).toBe(false);
      expect(window.dispatchEvent(new Event('contextmenu', { cancelable: true }))).toBe(false);

      touch(document.body, 'pointermove', 10);
      expect(itemOf(root, 'Ovoce').getAttribute('data-drop-pos')).toBe('child');
      touch(document.body, 'pointerup', 10);
      await vi.runAllTimersAsync();
      expect(move).toHaveBeenCalledWith(expect.objectContaining({ position: 'child', parent: NODES[0] }));
      expect(window.dispatchEvent(new Event('touchmove', { cancelable: true }))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test('children slide open and closed, and stay in the page until they are closed', async () => {
    const animations: { keyframes: Keyframe[]; animation: { onfinish: (() => void) | null; cancel: () => void } }[] = [];
    const animate = vi.fn((keyframes: Keyframe[]) => {
      const animation = { onfinish: null as (() => void) | null, cancel: vi.fn() };
      animations.push({ keyframes, animation });
      return animation;
    });
    HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate'];
    try {
      const tree = new Tree({ nodes: NODES });
      const root = mount(() => <TreeView tree={tree} />);
      (root.firstElementChild as HTMLElement).style.setProperty('--pt-anim-duration', '180ms');

      await tree.expand(tree.find(1)!);
      await tick();
      expect(animations.at(-1)!.keyframes[0]).toEqual({ height: '0px' });
      expect(labels(root)).toContain('Jablka');

      tree.collapse(tree.find(1)!);
      expect(animations.at(-1)!.keyframes.at(-1)).toEqual({ height: '0px' });
      expect(labels(root)).toContain('Jablka');
      animations.at(-1)!.animation.onfinish!();
      expect(labels(root)).toEqual(['Ovoce', 'Zelenina', 'Pečivo']);

      // Less motion wanted: no animation at all
      window.matchMedia = (query: string) => ({ matches: query.includes('reduce') }) as MediaQueryList;
      const count = animations.length;
      await tree.expand(tree.find(1)!);
      await tick();
      tree.collapse(tree.find(1)!);
      expect(animations.length).toBe(count);
      expect(labels(root)).toEqual(['Ovoce', 'Zelenina', 'Pečivo']);
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
      delete (window as Partial<Window>).matchMedia;
    }
  });
});

describe('addDropDownTreeSelect', () => {
  interface Product {
    categoryId: number | null;
  }

  function setup(required = false) {
    const { load, path } = lazy();
    const form = new Form<Product>();
    const category = form.addDropDownTreeSelect('categoryId', 'Kategorie:', { load, path, placeholder: 'Vyberte' });
    if (required) category.setRequired('Vyberte kategorii.');
    const root = mount(() => <FormView form={form} />);
    const trigger = root.querySelector<HTMLButtonElement>('[role=combobox]')!;
    return { form, category, root, trigger };
  }

  test('closed it shows the way to the picked node, also one set from code deep in a lazy tree', async () => {
    const { form, category, trigger } = setup();
    expect(trigger.textContent).toBe('Vyberte');
    form.setDefaults({ categoryId: 121 });
    expect(trigger.textContent).toBe('…');
    await tick();
    expect(trigger.textContent).toBe('Ovoce › Hrušky › Williams');
    expect(trigger.title).toBe('Ovoce › Hrušky › Williams');
    expect(category.getValue()).toBe(121);
    expect(trigger.getAttribute('aria-haspopup')).toBe('tree');
  });

  test('open it shows the tree with the picked node focused, a click picks and closes', async () => {
    const { form, category, root, trigger } = setup();
    form.setDefaults({ categoryId: 11 });
    await tick();
    trigger.click();
    await tick();
    const panel = root.querySelector('.phlox-dropdowntree-panel')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(labels(panel)).toEqual(['Ovoce', 'Jablka', 'Hrušky', 'Zelenina', 'Pečivo']);
    expect((document.activeElement as HTMLElement).dataset.id).toBe('11');
    expect(itemOf(panel, 'Jablka').getAttribute('aria-selected')).toBe('true');

    itemOf(panel, 'Zelenina').querySelector<HTMLElement>('.pt-label')!.click();
    expect(category.getValue()).toBe(2);
    expect(root.querySelector('.phlox-dropdowntree-panel')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.textContent).toBe('Zelenina');
  });

  test('the keyboard: arrow down opens, Enter picks, Escape closes only the panel', async () => {
    const { category, root, trigger } = setup();
    trigger.focus();
    key(trigger, 'ArrowDown');
    await tick();
    expect((document.activeElement as HTMLElement).dataset.id).toBe('1');
    key(document.activeElement!, 'ArrowRight');
    await tick();
    key(document.activeElement!, 'ArrowRight');
    key(document.activeElement!, 'Enter');
    expect(category.getValue()).toBe(11);
    expect(trigger.textContent).toBe('Ovoce › Jablka');

    key(trigger, 'Enter');
    await tick();
    const outside = vi.fn();
    root.addEventListener('keydown', outside);
    key(document.activeElement!, 'Escape');
    expect(outside).not.toHaveBeenCalled();
    expect(root.querySelector('.phlox-dropdowntree-panel')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  test('a value that is not required can be cleared, a required one is checked', async () => {
    const optional = setup();
    optional.category.setValue(3);
    await tick();
    expect(optional.trigger.textContent).toBe('Pečivo');
    optional.root.querySelector<HTMLButtonElement>('.phlox-dropdowntree-clear')!.click();
    expect(optional.category.getValue()).toBeNull();
    optional.category.setValue(3);
    key(optional.trigger, 'Delete');
    expect(optional.category.getValue()).toBeNull();
    document.body.replaceChildren();

    const required = setup(true);
    expect(required.root.querySelector('.phlox-dropdowntree-clear')).toBeNull();
    expect(await required.form.submit()).toBe(false);
    expect(required.category.errors()).toEqual(['Vyberte kategorii.']);
    expect(required.trigger.classList.contains('phlox-invalid')).toBe(true);
    expect(document.activeElement).toBe(required.trigger);
  });

  test('Bootstrap: the look of the dropdownlist', async () => {
    const form = new Form<Product>();
    form.addDropDownTreeSelect('categoryId', 'Kategorie:', { nodes: NODES });
    class Page extends Presenter {
      render() { return <FormView form={form} />; }
    }
    const { element } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    const trigger = element.querySelector<HTMLButtonElement>('[role=combobox]')!;
    expect(trigger.className).toBe('form-select text-start dropdownlist-bs-trigger');
    trigger.click();
    await tick();
    expect(element.querySelector('.phlox-dropdowntree-panel')!.className).toBe('dropdown-menu py-0 phlox-dropdowntree-panel');
  });
});
