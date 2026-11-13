import { state } from 'phlox-js';

export type Status = 'new' | 'paid' | 'sent';

export interface Order {
  id: number;
  customer: string;
  /** YYYY-MM-DD, as an API sends it. */
  date: string;
  price: number;
  status: Status;
}

export const STATUSES: { value: Status; text: string }[] = [
  { value: 'new', text: 'Nová' }, { value: 'paid', text: 'Zaplacená' }, { value: 'sent', text: 'Odeslaná' },
];

const CUSTOMERS = ['Alza Trading', 'Bohemia Glass', 'Čedok', 'Dřevotvar', 'Elektro Šmíd', 'Fénix', 'Grafo', 'Hruška a syn',
  'Jitona', 'Kovo Řež', 'Moravia Steel', 'Notino', 'Petrof', 'Rako', 'Tescoma'];

/** The same data on every load, a simple generator with a fixed start. */
function generate(): Order[] {
  let seed = 3;
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 48 }, (_, index) => ({
    id: 2001 + index,
    customer: CUSTOMERS[Math.floor(next() * CUSTOMERS.length)]!,
    date: new Date(Date.UTC(2026, 6, 1) + Math.floor(next() * 130) * 86_400_000).toISOString().slice(0, 10),
    price: Math.round(next() * 400) * 100 + 500,
    status: STATUSES[Math.floor(next() * 3)]!.value,
  }));
}

/** Orders kept in the browser, standing in for an API. */
export class Orders {
  readonly all = state<Order[]>(generate());

  async get(id: number): Promise<Order | null> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.all().find(order => order.id === id) ?? null;
  }

  async save(order: Order): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 150));
    this.all.update(list => list.map(other => (other.id === order.id ? order : other)));
  }
}
