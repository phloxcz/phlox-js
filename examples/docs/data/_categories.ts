// Categories for the demos of trees: a stand-in for a server that answers one level at a time, like an API.
import type { TreeNode } from '@phloxcz/phlox-js/components';

export interface CategoryNode extends TreeNode<number> {
  /** A category the server refuses to move, to show what happens then. */
  locked?: boolean;
}

interface Row { id: number; name: string; parentId: number | null; position: number; locked?: boolean }

const START: [number, string, number | null][] = [
  [1, 'Elektronika', null], [2, 'Telefony', 1], [3, 'Notebooky', 1], [4, 'Příslušenství', 1],
  [5, 'Nabíječky', 4], [6, 'Kabely', 4], [7, 'Pouzdra', 4],
  [8, 'Domácnost', null], [9, 'Kuchyně', 8], [10, 'Hrnce', 9], [11, 'Nože', 9],
  [12, 'Koupelna', 8], [13, 'Zahrada', null], [14, 'Nářadí', 13], [15, 'Osivo', 13],
  [16, 'Výprodej', null],
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class CategoryStore {
  private rows: Row[] = START.map(([id, name, parentId], position) => ({ id, name, parentId, position, locked: name === 'Výprodej' }));

  /** One level of the tree, for the `load` option. */
  public async children(parentId: number | null): Promise<CategoryNode[]> {
    await delay(parentId === null ? 100 : 300);
    return this.childrenOf(parentId).map(row => ({
      id: row.id, label: row.name, hasChildren: this.childrenOf(row.id).length > 0, locked: Boolean(row.locked),
    }));
  }

  /** Ids of the ancestors from the top, for the `path` option. */
  public async path(id: number): Promise<number[]> {
    await delay(100);
    const path: number[] = [];
    for (let row = this.find(id); row?.parentId != null; row = this.find(row.parentId)) path.unshift(row.parentId);
    return path;
  }

  public name(id: number): string {
    return this.find(id)?.name ?? '';
  }

  /** Moves a category under a parent at a position among its children, as the tree reports it. */
  public async move(id: number, parentId: number | null, index: number): Promise<void> {
    await delay(300);
    const row = this.find(id)!;
    if (row.locked) throw new Error(`Kategorii „${row.name}“ server nedovolí přesunout.`);
    const siblings = this.childrenOf(parentId).filter(other => other !== row);
    siblings.splice(index, 0, row);
    row.parentId = parentId;
    siblings.forEach((sibling, position) => { sibling.position = position; });
  }

  private find(id: number): Row | undefined {
    return this.rows.find(row => row.id === id);
  }

  private childrenOf(parentId: number | null): Row[] {
    return this.rows.filter(row => row.parentId === parentId).sort((a, b) => a.position - b.position);
  }
}
