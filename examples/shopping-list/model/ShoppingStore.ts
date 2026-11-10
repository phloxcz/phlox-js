export interface Item {
  id: number;
  name: string;
  done: boolean;
}

/** Stands in for a server API: asynchronous and it always returns new objects. */
export class ShoppingStore {
  private items: Item[] = [];
  private lastId = 0;

  async list(): Promise<Item[]> {
    return this.items.map(item => ({ ...item }));
  }

  async get(id: number): Promise<Item | null> {
    const item = this.items.find(other => other.id === id);
    return item ? { ...item } : null;
  }

  async add(name: string): Promise<void> {
    this.items.push({ id: ++this.lastId, name, done: false });
  }

  async update(id: number, changes: Partial<Omit<Item, 'id'>>): Promise<void> {
    this.items = this.items.map(item => (item.id === id ? { ...item, ...changes } : item));
  }

  async remove(id: number): Promise<void> {
    this.items = this.items.filter(item => item.id !== id);
  }
}
