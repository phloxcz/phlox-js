import { applyQuery } from 'phlox-js/components';
import type { GridQuery, GridResult } from 'phlox-js/components';

export interface Order {
  id: number;
  customer: string;
  product: string;
  category: string;
  owner: string;
  price: number;
  /** The date as an API sends it, YYYY-MM-DD. */
  created: string;
  paid: boolean;
}

export const CATEGORIES = ['Elektronika', 'Domácnost', 'Zahrada', 'Sport', 'Knihy'];

const CUSTOMERS = ['Alza Trading', 'Bohemia Glass', 'Čedok', 'Dřevotvar', 'Elektro Šmíd', 'Fénix', 'Grafo', 'Hruška a syn',
  'Ivax', 'Jitona', 'Kovo Řež', 'Lesy ČR', 'Moravia Steel', 'Notino', 'Okál', 'Petrof', 'Rako', 'Škoda Transport', 'Tescoma', 'Úsovsko'];
const PRODUCTS: Record<string, string[]> = {
  Elektronika: ['Notebook', 'Monitor', 'Tiskárna', 'Telefon', 'Router'],
  Domácnost: ['Hrnec', 'Konvice', 'Mixér', 'Vysavač', 'Lampa'],
  Zahrada: ['Sekačka', 'Hadice', 'Gril', 'Nůžky', 'Osivo'],
  Sport: ['Kolo', 'Stan', 'Lyže', 'Batoh', 'Míč'],
  Knihy: ['Atlas', 'Slovník', 'Kuchařka', 'Román', 'Učebnice'],
};
const OWNERS = ['Anna Malá', 'Bohumil Hrabal', 'Cyril Novák', 'Dana Veselá', 'Eva Černá', 'František Kos',
  'Gabriela Horká', 'Hynek Mácha', 'Ivana Dvořáková', 'Jan Procházka', 'Klára Benešová', 'Lukáš Pokorný'];

const KEY = 'phlox-grid-example';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** The same data on every load: a simple generator of pseudo-random numbers with a fixed start. */
function generate(): Order[] {
  let seed = 7;
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = <T,>(list: T[]) => list[Math.floor(next() * list.length)]!;
  return Array.from({ length: 137 }, (_, index) => {
    const category = pick(CATEGORIES);
    const day = new Date(Date.UTC(2026, 0, 1) + Math.floor(next() * 300) * 86_400_000);
    return {
      id: 1001 + index,
      customer: pick(CUSTOMERS),
      product: pick(PRODUCTS[category]!),
      category,
      owner: pick(OWNERS),
      price: Math.round(next() * 500) * 100 + 100,
      created: day.toISOString().slice(0, 10),
      paid: next() < 0.6,
    };
  });
}

/**
 * Stands in for an API with phloxcz/api-query: it takes the query of the grid and returns one page.
 * The data stay in sessionStorage, so changes survive a reload.
 */
export class OrderStore {
  private orders: Order[];

  constructor() {
    try {
      this.orders = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') ?? generate();
    } catch {
      this.orders = generate();
    }
  }

  /** What a POST /orders/query of phloxcz/api-query would do, here with applyQuery() of the framework. */
  async list(query: GridQuery): Promise<GridResult<Order>> {
    await delay(250);
    return applyQuery(this.orders, query, ['customer', 'product', 'owner']);
  }

  async get(id: number): Promise<Order | null> {
    await delay(100);
    const order = this.orders.find(other => other.id === id);
    return order ? { ...order } : null;
  }

  /** Owners for the filter with search, like an endpoint for a DropDownList. */
  async owners(text: string): Promise<string[]> {
    await delay(150);
    const words = text.toLocaleLowerCase('cs');
    return OWNERS.filter(owner => owner.toLocaleLowerCase('cs').includes(words));
  }

  async setPaid(ids: number[], paid: boolean): Promise<void> {
    await delay(200);
    for (const order of this.orders) if (ids.includes(order.id)) order.paid = paid;
    this.save();
  }

  async remove(ids: number[]): Promise<void> {
    await delay(200);
    this.orders = this.orders.filter(order => !ids.includes(order.id));
    this.save();
  }

  private save(): void {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(this.orders));
    } catch {
      // Not remembered, the example works until the page is closed
    }
  }
}
