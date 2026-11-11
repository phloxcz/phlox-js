/**
 * The tree: nodes, their expansion, the selected node, checked nodes and moving, like phloxcz/components-tree.
 * This is the model, <TreeView> draws it. Nodes come all at once (`nodes`) or level by level (`load`).
 */

import { batch, state, untrack } from '../reactive/reactive';
import type { State } from '../reactive/reactive';

export type TreeKey = string | number;

/** A node as the application gives it. More fields can be added, the tree passes the node on unchanged. */
export interface TreeNode<K extends TreeKey = TreeKey> {
  id: K;
  label: string;
  /** Children given at once. With `load` they are optional, a node without them is loaded when expanded. */
  children?: TreeNode<K>[];
  /** With `load`: whether the node has children to load, so it can be expanded. */
  hasChildren?: boolean;
  /** Cannot be selected, checked or dragged. */
  disabled?: boolean;
}

/** Where a dragged node goes: in front of the target, behind it, or as its last child. */
export type TreePosition = 'before' | 'after' | 'child';

export interface TreeMove<N> {
  node: N;
  target: N;
  position: TreePosition;
  /** The new parent, null for the top level, and the new position among its children. */
  parent: N | null;
  index: number;
}

export interface TreeOptions<N extends TreeNode<any>> {
  /** The whole tree at once. */
  nodes?: N[];
  /** Children of a node, or the top level for null, typically from the server. Called when a node is expanded. */
  load?: (parent: N | null) => Promise<N[]>;
  /** Ids of the ancestors of a node from the top, so a node not loaded yet can be shown (select, reveal). */
  path?: (id: N['id']) => Promise<N['id'][]>;
  /** Remembers expanded nodes in the browser under this key, across page loads. */
  remember?: string;
  /** Nodes can be moved by dragging. A function says which ones. */
  draggable?: boolean | ((node: N) => boolean);
  /**
   * Called after a node was moved by dragging, typically to save it on the server.
   * When it fails, the node goes back to its place and the error goes on.
   */
  move?: (move: TreeMove<N>) => void | Promise<void>;
  /** Nodes are picked with a radio button or checkboxes, see checked. */
  pick?: 'single' | 'multiple';
}

/** One node in the tree, with its state. */
export class TreeItem<N extends TreeNode<any>> {
  /** Null until the children are loaded. */
  readonly children = state<TreeItem<N>[] | null>(null);
  readonly expanded = state(false);
  readonly loading = state(false);
  readonly parent: State<TreeItem<N> | null>;
  /** The element of the node while it is shown, for the focus. */
  element: HTMLElement | null = null;

  constructor(readonly node: N, parent: TreeItem<N> | null) {
    this.parent = state(parent);
  }

  get id(): N['id'] {
    return this.node.id;
  }

  hasChildren(): boolean {
    const children = this.children();
    return children ? children.length > 0 : Boolean(this.node.hasChildren || this.node.children?.length);
  }

  /** Parents from the top level down to the direct one. */
  ancestors(): TreeItem<N>[] {
    const ancestors: TreeItem<N>[] = [];
    for (let parent = this.parent(); parent; parent = parent.parent()) ancestors.unshift(parent);
    return ancestors;
  }

  /** Whether this node is inside the other one, at any depth. */
  isInside(other: TreeItem<N>): boolean {
    return this.ancestors().includes(other);
  }
}

export class Tree<N extends TreeNode<any> = TreeNode> {
  static texts = { expand: 'Expand', collapse: 'Collapse', loading: 'Loading…' };

  readonly roots = state<TreeItem<N>[]>([]);
  /** The selected node, e.g. the one the page shows. */
  readonly selected = state<N['id'] | null>(null);
  /** Picked nodes with `pick`. */
  readonly checked = state<N['id'][]>([]);
  /** Called when the user selects a node, not when select() is called from code. */
  onSelect: ((node: N) => void) | null = null;
  private loaded: Promise<void> | null = null;

  constructor(readonly options: TreeOptions<N> = {}) {
    if (options.nodes) {
      this.roots.set(this.build(options.nodes, null));
      this.loaded = this.restore(untrack(this.roots));
    }
  }

  /** Loads the top level, once. Await it in startup() when the tree must be ready, e.g. for select(). */
  load(): Promise<void> {
    this.loaded ??= this.reload();
    return this.loaded;
  }

  /** Loads the tree again, e.g. after a change on the server. Remembered nodes are expanded again. */
  async reload(): Promise<void> {
    const nodes = this.options.load ? await this.options.load(null) : (this.options.nodes ?? []);
    const roots = this.build(nodes, null);
    this.roots.set(roots);
    await this.restore(roots);
  }

  /** A loaded node by its id. */
  find(id: N['id']): TreeItem<N> | undefined {
    const search = (items: TreeItem<N>[]): TreeItem<N> | undefined => {
      for (const item of items) {
        if (item.id === id) return item;
        const found = search(untrack(item.children) ?? []);
        if (found) return found;
      }
      return undefined;
    };
    return search(untrack(this.roots));
  }

  /** Nodes the user can see, from the top down: expanded nodes show their children. */
  visible(): TreeItem<N>[] {
    const list: TreeItem<N>[] = [];
    const walk = (items: TreeItem<N>[]): void => {
      for (const item of items) {
        list.push(item);
        if (item.expanded()) walk(item.children() ?? []);
      }
    };
    walk(this.roots());
    return list;
  }

  async expand(item: TreeItem<N>): Promise<void> {
    if (!item.hasChildren()) return;
    const fresh = !untrack(item.children);
    await this.loadChildren(item);
    item.expanded.set(true);
    // Children loaded just now open as they were remembered, before the state is saved again
    if (fresh) await this.restore(untrack(item.children) ?? []);
    this.save();
  }

  collapse(item: TreeItem<N>): void {
    item.expanded.set(false);
    this.save();
  }

  toggle(item: TreeItem<N>): Promise<void> {
    if (untrack(item.expanded)) {
      this.collapse(item);
      return Promise.resolve();
    }
    return this.expand(item);
  }

  /** Expands the ancestors of a node, loading them with `path` when needed. Returns the node, or null. */
  async reveal(id: N['id']): Promise<TreeItem<N> | null> {
    await this.load();
    let item = this.find(id);
    if (!item && this.options.path) {
      for (const ancestor of await this.options.path(id)) {
        const parent = this.find(ancestor);
        if (parent) await this.loadChildren(parent);
      }
      item = this.find(id);
    }
    if (!item) return null;
    for (const ancestor of item.ancestors()) await this.expand(ancestor);
    return item;
  }

  /** Selects a node from code, e.g. by the id from the URL, and shows it. Null clears the selection. */
  async select(id: N['id'] | null): Promise<void> {
    this.selected.set(id);
    if (id !== null) await this.reveal(id);
  }

  /** The user selected a node. */
  choose(item: TreeItem<N>): void {
    if (item.node.disabled) return;
    this.selected.set(item.id);
    this.onSelect?.(item.node);
  }

  /** Picks or unpicks a node, with `pick`. */
  check(item: TreeItem<N>, on = !untrack(this.checked).includes(item.id)): void {
    if (item.node.disabled) return;
    if (this.options.pick === 'single') this.checked.set(on ? [item.id] : []);
    else this.checked.update(ids => (on ? [...ids.filter(id => id !== item.id), item.id] : ids.filter(id => id !== item.id)));
  }

  canDrag(item: TreeItem<N>): boolean {
    const { draggable } = this.options;
    if (item.node.disabled || !draggable) return false;
    return draggable === true || draggable(item.node);
  }

  /** Whether a node can go there: not onto itself, not into its own subtree, not into its own parent again. */
  canDrop(item: TreeItem<N>, target: TreeItem<N>, position: TreePosition): boolean {
    if (target === item || target.isInside(item)) return false;
    if (position === 'child') return !target.node.disabled && target !== untrack(item.parent);
    return true;
  }

  /**
   * Moves a node, as dragging does. Calls the `move` option; when it fails, the node goes back and the error
   * is thrown on. Returns false when the node did not move (the same place, or not allowed).
   */
  async move(item: TreeItem<N>, target: TreeItem<N>, position: TreePosition): Promise<boolean> {
    if (!this.canDrop(item, target, position)) return false;
    const from = { parent: untrack(item.parent), index: this.siblings(untrack(item.parent)).indexOf(item) };
    const parent = position === 'child' ? target : untrack(target.parent);
    if (position === 'child') await this.loadChildren(target);

    const others = this.siblings(parent).filter(other => other !== item);
    const index = position === 'child' ? others.length : others.indexOf(target) + (position === 'after' ? 1 : 0);
    if (parent === from.parent && index === from.index) return false;

    this.place(item, parent, index);
    if (position === 'child') target.expanded.set(true);
    try {
      await this.options.move?.({ node: item.node, target: target.node, position, parent: parent?.node ?? null, index });
    } catch (error) {
      this.place(item, from.parent, from.index);
      throw error;
    }
    return true;
  }

  private build(nodes: N[], parent: TreeItem<N> | null): TreeItem<N>[] {
    return nodes.map(node => {
      const item = new TreeItem(node, parent);
      // Without `load` a node without children is a leaf, with `load` its children come later
      if (node.children || !this.options.load) item.children.set(this.build((node.children ?? []) as N[], item));
      return item;
    });
  }

  private async loadChildren(item: TreeItem<N>): Promise<void> {
    if (untrack(item.children)) return;
    if (!this.options.load || !item.node.hasChildren) {
      item.children.set([]);
      return;
    }
    item.loading.set(true);
    try {
      item.children.set(this.build(await this.options.load(item.node), item));
    } finally {
      item.loading.set(false);
    }
  }

  private siblings(parent: TreeItem<N> | null): TreeItem<N>[] {
    return (parent ? untrack(parent.children) : untrack(this.roots)) ?? [];
  }

  /** Takes a node from where it is and puts it under the parent at the index. */
  private place(item: TreeItem<N>, parent: TreeItem<N> | null, index: number): void {
    const listOf = (owner: TreeItem<N> | null) => (owner ? owner.children : this.roots) as State<TreeItem<N>[]>;
    batch(() => {
      listOf(untrack(item.parent)).update(items => items.filter(other => other !== item));
      listOf(parent).update(items => [...items.slice(0, index), item, ...items.slice(index)]);
      item.parent.set(parent);
    });
  }

  // Remembered expanded nodes

  private storageKey(): string | null {
    return this.options.remember ? `phlox-tree:${this.options.remember}` : null;
  }

  private remembered(): Set<TreeKey> {
    const key = this.storageKey();
    if (!key) return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as TreeKey[]);
    } catch {
      return new Set();
    }
  }

  private save(): void {
    const key = this.storageKey();
    if (!key) return;
    const expanded: TreeKey[] = [];
    const walk = (items: TreeItem<N>[]): void => {
      for (const item of items) {
        if (untrack(item.expanded)) expanded.push(item.id);
        walk(untrack(item.children) ?? []);
      }
    };
    walk(untrack(this.roots));
    // Nodes not loaded now (under a collapsed parent of a lazy tree) keep their remembered state
    const kept = [...this.remembered()].filter(id => !this.find(id));
    try {
      localStorage.setItem(key, JSON.stringify([...kept, ...expanded]));
    } catch {
      // Not remembered, the tree still works
    }
  }

  private async restore(items: TreeItem<N>[]): Promise<void> {
    const remembered = this.remembered();
    if (!remembered.size) return;
    const expand = async (level: TreeItem<N>[]): Promise<void> => {
      await Promise.all(level.filter(item => remembered.has(item.id)).map(async item => {
        await this.loadChildren(item);
        if (item.hasChildren()) item.expanded.set(true);
        await expand(untrack(item.children) ?? []);
      }));
    };
    await expand(items);
  }
}
