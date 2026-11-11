import type { TreeNode } from 'phlox-js/components';

/** A category as the server sends it for the tree. */
export interface CategoryNode extends TreeNode<number> {
  /** A category that may not be moved, to show what happens when the server refuses. */
  locked?: boolean;
}

export interface Category {
  id: number;
  name: string;
  parentId: number | null;
  products: number;
  locked: boolean;
  /** Other categories where the products are shown too. */
  alsoIn: number[];
}

interface Row {
  id: number;
  name: string;
  parentId: number | null;
  /** Order among the siblings. */
  position: number;
  products: number;
  locked?: boolean;
  alsoIn?: number[];
}

const START: [number, string, number | null, number][] = [
  [1, 'Elektronika', null, 0], [2, 'Telefony', 1, 42], [3, 'Notebooky', 1, 18], [4, 'Příslušenství', 1, 0],
  [5, 'Nabíječky', 4, 25], [6, 'Kabely', 4, 61], [7, 'Pouzdra', 4, 33],
  [8, 'Domácnost', null, 0], [9, 'Kuchyně', 8, 0], [10, 'Hrnce', 9, 14], [11, 'Nože', 9, 9],
  [12, 'Koupelna', 8, 21], [13, 'Zahrada', null, 0], [14, 'Nářadí', 13, 37], [15, 'Osivo', 13, 12],
  [16, 'Výprodej', null, 8],
];

const KEY = 'phlox-tree-example';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Stands in for a server: asynchronous, slower for children, and it keeps its data in sessionStorage.
 * The tree asks it only for one level at a time, as it would ask an API.
 */
export class CategoryStore {
  private rows: Row[];

  constructor() {
    let saved: Row[] | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    } catch {
      // A broken storage means the starting data
    }
    this.rows = saved ?? START.map(([id, name, parentId, products], position) =>
      ({ id, name, parentId, position, products, locked: name === 'Výprodej' }));
  }

  /** One level of the tree, for its `load` option. */
  async children(parentId: number | null): Promise<CategoryNode[]> {
    await delay(parentId === null ? 100 : 300);
    return this.childrenOf(parentId).map(row => ({
      id: row.id,
      label: row.name,
      hasChildren: this.childrenOf(row.id).length > 0,
      locked: Boolean(row.locked),
    }));
  }

  /** Ids of the ancestors from the top, for the `path` option: a link to a deep category opens the way to it. */
  async path(id: number): Promise<number[]> {
    await delay(100);
    const path: number[] = [];
    for (let row = this.find(id); row?.parentId != null; row = this.find(row.parentId)) path.unshift(row.parentId);
    return path;
  }

  async get(id: number): Promise<Category | null> {
    await delay(100);
    const row = this.find(id);
    return row
      ? { id: row.id, name: row.name, parentId: row.parentId, products: row.products, locked: Boolean(row.locked), alsoIn: [...(row.alsoIn ?? [])] }
      : null;
  }

  /** Moves a category under a parent at a position among its children, as the tree reports it. */
  async move(id: number, parentId: number | null, index: number): Promise<void> {
    await delay(300);
    const row = this.find(id)!;
    if (row.locked) throw new Error(`Kategorii „${row.name}“ server nedovolí přesunout.`);
    const siblings = this.childrenOf(parentId).filter(other => other !== row);
    siblings.splice(index, 0, row);
    row.parentId = parentId;
    siblings.forEach((sibling, position) => { sibling.position = position; });
    this.save();
  }

  async update(id: number, values: { name: string; parentId: number | null; alsoIn: number[] }): Promise<void> {
    await delay(200);
    const row = this.find(id)!;
    for (let parent = values.parentId; parent !== null; parent = this.find(parent)!.parentId) {
      if (parent === id) throw new Error('Kategorie nemůže být uvnitř sebe sama.');
    }
    if (row.parentId !== values.parentId) {
      row.position = this.childrenOf(values.parentId).length;
      row.parentId = values.parentId;
    }
    row.name = values.name;
    row.alsoIn = values.alsoIn;
    this.save();
  }

  private find(id: number): Row | undefined {
    return this.rows.find(row => row.id === id);
  }

  private childrenOf(parentId: number | null): Row[] {
    return this.rows.filter(row => row.parentId === parentId).sort((a, b) => a.position - b.position);
  }

  private save(): void {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(this.rows));
    } catch {
      // Not remembered, the example still works until the page is closed
    }
  }
}
