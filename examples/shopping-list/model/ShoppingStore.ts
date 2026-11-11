import { foldText } from 'phlox-js/forms';

export interface Item {
  id: number;
  name: string;
  done: boolean;
  category: number | null;
}

/** Categories of items. In a real application they would be a table on the server. */
export const CATEGORIES: [number, string][] = [
  [1, 'Pečivo'], [2, 'Mléčné výrobky'], [3, 'Ovoce a zelenina'], [4, 'Maso a uzeniny'],
  [5, 'Nápoje'], [6, 'Drogerie'], [7, 'Sladkosti'], [8, 'Mražené'],
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** One change of the name of an item. `from` is null for the name it was created with. */
export interface Change {
  at: string;
  from: string | null;
  to: string;
}

interface Saved {
  items: Item[];
  changes: Record<number, Change[]>;
  lastId: number;
}

const KEY = 'phlox-shopping-list';

/**
 * Stands in for a server API: asynchronous and it always returns new objects.
 * It keeps its data in sessionStorage, so a direct link to a dialog works after a reload too.
 */
export class ShoppingStore {
  private data: Saved = { items: [], changes: {}, lastId: 0 };

  constructor() {
    try {
      this.data = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') ?? this.data;
    } catch {
      // A broken or blocked storage means an empty list
    }
  }

  async list(): Promise<Item[]> {
    return this.data.items.map(item => ({ ...item, category: item.category ?? null }));
  }

  async get(id: number): Promise<Item | null> {
    const item = this.data.items.find(other => other.id === id);
    return item ? { ...item, category: item.category ?? null } : null;
  }

  async changes(id: number): Promise<Change[]> {
    return (this.data.changes[id] ?? []).map(change => ({ ...change }));
  }

  async add(name: string, category: number | null = null): Promise<void> {
    const id = ++this.data.lastId;
    this.data.items.push({ id, name, done: false, category });
    this.data.changes[id] = [{ at: new Date().toISOString(), from: null, to: name }];
    this.save();
  }

  async update(id: number, changes: Partial<Omit<Item, 'id'>>): Promise<void> {
    this.data.items = this.data.items.map(item => {
      if (item.id !== id) return item;
      if (changes.name !== undefined && changes.name !== item.name) {
        (this.data.changes[id] ??= []).push({ at: new Date().toISOString(), from: item.name, to: changes.name });
      }
      return { ...item, ...changes };
    });
    this.save();
  }

  /** Like a search on the server: it takes a while and returns only what matches. */
  async searchCategories(query: string): Promise<[number, string][]> {
    await delay(200);
    const folded = foldText(query);
    return CATEGORIES.filter(([, name]) => foldText(name).includes(folded));
  }

  async categoryName(id: number): Promise<string | null> {
    await delay(100);
    return CATEGORIES.find(([key]) => key === id)?.[1] ?? null;
  }

  async remove(id: number): Promise<void> {
    this.data.items = this.data.items.filter(item => item.id !== id);
    delete this.data.changes[id];
    this.save();
  }

  private save(): void {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Not remembered, the list still works until the page is closed
    }
  }
}
