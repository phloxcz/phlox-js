import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BootstrapTheme, Container, Presenter, render } from '../src/index';
import type { Child, Route } from '../src/index';
import { Grid, GridView, applyQuery } from '../src/components/index';
import type { GridQuery } from '../src/components/index';
import { boot, tick } from './helpers';

interface Order {
  id: number;
  customer: string;
  category: string;
  price: number;
  created: string;
  paid: boolean;
}

const ORDERS: Order[] = [
  { id: 1, customer: 'Fénix', category: 'Knihy', price: 300, created: '2026-01-10', paid: true },
  { id: 2, customer: 'Kovo Řež', category: 'Sport', price: 100, created: '2026-02-05', paid: false },
  { id: 3, customer: 'Alza', category: 'Knihy', price: 200, created: '2026-03-01', paid: true },
  { id: 4, customer: 'Grafo', category: 'Zahrada', price: 400, created: '2026-03-20T10:00:00', paid: false },
  { id: 5, customer: 'Fénix', category: 'Sport', price: 500, created: '2026-04-02', paid: true },
];

function ordersGrid(options: ConstructorParameters<typeof Grid<Order>>[0] = { rows: ORDERS, pageSize: 2 }) {
  const grid = new Grid<Order>(options);
  grid.addNumberColumn('id', 'Číslo').sortable();
  grid.addTextColumn('customer', 'Zákazník').sortable().searchable().filterable();
  grid.addTextColumn('category', 'Kategorie').filterSelect(['Knihy', 'Sport', 'Zahrada'], true);
  grid.addNumberColumn('price', 'Cena').sortable().filterable().aggregate('sum');
  grid.addDateColumn('created', 'Vytvořeno').filterable();
  grid.addBoolColumn('paid', 'Zaplaceno').filterable();
  return grid;
}

function mount(view: () => Child) {
  const root = document.createElement('div');
  document.body.append(root);
  render(view, root);
  return root;
}

const ids = (grid: Grid<Order>) => grid.rows().map(order => order.id);
const cells = (root: HTMLElement, key: string) => [...root.querySelectorAll(`tbody td[data-col-key="${key}"]`)].map(cell => cell.textContent);

beforeEach(() => localStorage.clear());
afterEach(() => document.body.replaceChildren());

describe('the query', () => {
  test('has the format of phloxcz/api-query', async () => {
    const load = vi.fn(async (_query: GridQuery) => ({ data: [] as Order[], total: 0 }));
    const grid = ordersGrid({ load, pageSize: 20 });
    await grid.sortBy('price');
    await grid.sortBy('price');
    await grid.setSearch(' fénix ');
    await grid.setFilter('category', ['Knihy', 'Sport']);
    await grid.setFilter('price', '100..300');
    await grid.setFilter('created', '..2026-03-01');
    await grid.setFilter('paid', '1');
    await grid.goTo(2);
    expect(load).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
      sort: [{ field: 'price', dir: 'desc' }],
      search: 'fénix',
      filter: { logic: 'and', filters: [
        { field: 'category', operator: 'in', value: ['Knihy', 'Sport'] },
        { field: 'price', operator: 'gte', value: 100 },
        { field: 'price', operator: 'lte', value: 300 },
        { field: 'created', operator: 'lte', value: '2026-03-01' },
        { field: 'paid', operator: 'eq', value: true },
      ] },
      aggregate: [{ field: 'price', aggregate: 'sum' }],
    });
  });

  test('applyQuery does the same in the browser: search, filters, sort, totals, pages', () => {
    const query: GridQuery = { page: 1, pageSize: 10, sort: [{ field: 'price', dir: 'desc' }], aggregate: [{ field: 'price', aggregate: 'sum' }] };
    expect(applyQuery(ORDERS, { ...query, search: 'fenix' }, ['customer']).data.map(order => order.id)).toEqual([5, 1]);
    const filtered = applyQuery(ORDERS, { ...query, filter: { logic: 'and', filters: [
      { field: 'category', operator: 'in', value: ['Knihy', 'Zahrada'] },
      { field: 'created', operator: 'lte', value: '2026-03-20' },
    ] } });
    // A date and time on the last day of a range is in it
    expect(filtered.data.map(order => order.id)).toEqual([4, 1, 3]);
    expect(filtered.aggregates).toEqual({ price: { sum: 900 } });
    const page = applyQuery(ORDERS, { page: 2, pageSize: 2, sort: [{ field: 'id', dir: 'asc' }] });
    expect(page).toMatchObject({ total: 5, data: [{ id: 3 }, { id: 4 }] });
  });

  test('rows in the browser: sorting in three states, pages, search, filters, totals', async () => {
    const grid = ordersGrid();
    await grid.load();
    expect(ids(grid)).toEqual([1, 2]);
    expect(grid.pages()).toBe(3);
    await grid.sortBy('price');
    expect(ids(grid)).toEqual([2, 3]);
    await grid.sortBy('price');
    expect(ids(grid)).toEqual([5, 4]);
    await grid.sortBy('price');
    expect(grid.sort()).toBeNull();
    await grid.goTo(3);
    expect(ids(grid)).toEqual([5]);
    await grid.setSearch('ŘEŽ');
    expect(grid.page()).toBe(1);
    expect(ids(grid)).toEqual([2]);
    await grid.reset();
    await grid.setFilter('paid', '0');
    expect(grid.total()).toBe(2);
    expect(grid.aggregates()).toEqual({ price: { sum: 500 } });
  });

  test('a page past the end, e.g. after deleting rows, goes to the last one', async () => {
    const rows = [...ORDERS];
    const grid = ordersGrid({ rows: () => rows, pageSize: 2 });
    await grid.load();
    await grid.goTo(3);
    rows.splice(4, 1);
    await grid.load();
    expect(grid.page()).toBe(2);
    expect(ids(grid)).toEqual([3, 4]);
  });

  test('an older answer does not overwrite a newer one', async () => {
    const answers: ((rows: Order[]) => void)[] = [];
    const grid = ordersGrid({ load: () => new Promise(resolve => answers.push(rows => resolve({ data: rows, total: rows.length }))) });
    const first = grid.load();
    const second = grid.load();
    answers[1]!([ORDERS[1]!]);
    answers[0]!([ORDERS[0]!]);
    await Promise.all([first, second]);
    expect(ids(grid)).toEqual([2]);
    expect(grid.loading()).toBe(false);
  });
});

describe('the URL', () => {
  const grid = ordersGrid({ rows: ORDERS, pageSize: 2 });

  class Orders extends Presenter {
    override routes: Route[] = [{ name: 'default', pattern: '/' }, { name: 'detail', pattern: '/<id \\d+>' }];
    readonly grid = grid;
    constructor() {
      super();
      grid.bind(this);
    }
    render() { return <GridView grid={grid} />; }
  }

  test('the state is in the URL, Back returns it, links of the presenter keep it', async () => {
    const { app, element } = await boot(Orders, '/?sort=-price&f.category=Knihy,Sport&page=2');
    await tick();
    expect(grid.sort()).toEqual({ field: 'price', dir: 'desc' });
    expect(grid.filters()).toEqual({ category: ['Knihy', 'Sport'] });
    expect(ids(grid)).toEqual([3, 2]);
    expect(cells(element, 'id')).toEqual(['3', '2']);

    await grid.setFilter('customer', 'fénix');
    await tick();
    expect(location.search).toBe('?sort=-price&f.category=Knihy%2CSport&f.customer=f%C3%A9nix');
    expect(ids(grid)).toEqual([5, 1]);
    expect(app.presenter!.link('detail', { id: 5 })).toBe('/5?sort=-price&f.category=Knihy%2CSport&f.customer=f%C3%A9nix');

    history.back();
    await tick();
    await tick();
    expect(grid.page()).toBe(2);
    expect(grid.filters()).toEqual({ category: ['Knihy', 'Sport'] });
  });
});

describe('the view', () => {
  test('headers with sorting, rows, totals and pages', async () => {
    const grid = ordersGrid();
    const root = mount(() => <GridView grid={grid} aria-label="Objednávky" />);
    await tick();
    expect([...root.querySelectorAll('thead tr:first-child th')].map(th => th.textContent)).toEqual(['Číslo', 'Zákazník', 'Kategorie', 'Cena', 'Vytvořeno', 'Zaplaceno']);
    const price = root.querySelector('th[data-col-key="price"]')!;
    expect(price.getAttribute('aria-sort')).toBe('none');
    price.querySelector('button')!.click();
    await tick();
    expect(price.getAttribute('aria-sort')).toBe('ascending');
    expect(cells(root, 'price')).toEqual([(100).toLocaleString(), (200).toLocaleString()]);
    expect(cells(root, 'paid')).toEqual(['–', '✓']);
    expect(root.querySelector('tfoot td[data-col-key="price"]')!.textContent).toBe(`Total${(1500).toLocaleString()}`);
    expect(root.querySelector('.phx-grid-footer [role=status]')!.textContent).toBe('1–2 of 5');

    root.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.click();
    await tick();
    expect(cells(root, 'id')).toEqual(['1', '4']);
    expect(root.querySelector('[aria-current=page]')!.textContent).toBe('2');
  });

  test('filters in the filter row, and the reset', async () => {
    const grid = ordersGrid({ rows: ORDERS, pageSize: 10 });
    const root = mount(() => <GridView grid={grid} search />);
    await tick();
    const input = root.querySelector<HTMLInputElement>('th[data-col-key="customer"] input')!;
    input.value = 'fénix';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await tick();
    expect(cells(root, 'customer')).toEqual(['Fénix', 'Fénix']);
    const paid = root.querySelector<HTMLSelectElement>('th[data-col-key="paid"] select')!;
    paid.value = '1';
    paid.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(cells(root, 'id')).toEqual(['1', '5']);
    const reset = [...root.querySelectorAll('button')].find(button => button.textContent?.includes('Reset'))!;
    reset.click();
    await tick();
    expect(cells(root, 'id')).toHaveLength(5);
    expect(input.value).toBe('');
  });

  test('actions on a row and on selected rows, with a question', async () => {
    const rows = [...ORDERS];
    const remove = (keys: unknown[]) => { for (const key of keys) rows.splice(rows.findIndex(order => order.id === key), 1); };
    const grid = ordersGrid({ rows: () => rows, pageSize: 10 });
    grid.addAction('Detail', { href: order => `/orders/${order.id}`, primary: true });
    grid.addAction('Smazat', { onClick: order => remove([order.id]), danger: true, confirm: order => `Smazat ${order.id}?` });
    grid.addBulkAction('Smazat vybrané', keys => remove(keys), { confirm: 'Opravdu?' });
    const asked: string[] = [];
    Grid.confirm = question => { asked.push(question); return true; };
    try {
      const root = mount(() => <GridView grid={grid} />);
      await tick();
      expect(root.querySelector('tbody tr a')!.getAttribute('href')).toBe('/orders/1');

      // The menu of the first row
      root.querySelector<HTMLButtonElement>('tbody tr .phx-grid-action-toggle')!.click();
      [...document.querySelectorAll<HTMLButtonElement>('[role=menu] button')].find(button => button.textContent === 'Smazat')!.click();
      await tick();
      expect(asked).toEqual(['Smazat 1?']);
      expect(cells(root, 'id')).toEqual(['2', '3', '4', '5']);

      // Selected rows
      const checks = root.querySelectorAll<HTMLInputElement>('tbody .phx-grid-row-check');
      checks[0]!.click();
      checks[2]!.click();
      expect(root.querySelector('.phx-grid-bulk-bar')!.textContent).toContain('Selected: 2');
      expect(root.querySelector<HTMLInputElement>('.phx-grid-check-all')!.indeterminate).toBe(true);
      [...root.querySelectorAll<HTMLButtonElement>('.phx-grid-bulk-bar button')].find(button => button.textContent === 'Smazat vybrané')!.click();
      await tick();
      expect(asked).toEqual(['Smazat 1?', 'Opravdu?']);
      expect(cells(root, 'id')).toEqual(['3', '5']);
      expect(root.querySelector('.phx-grid-bulk-bar')).toBeNull();
    } finally {
      Grid.confirm = null;
    }
  });

  test('columns: hidden, moved and their widths, remembered in the browser', async () => {
    const grid = ordersGrid({ rows: ORDERS, remember: 'orders' });
    grid.toggleColumn('category', false);
    grid.shiftColumn('price', -1);
    grid.setWidth('customer', '220px');
    const again = ordersGrid({ rows: ORDERS, remember: 'orders' });
    expect(again.visibleColumns().map(column => column.key)).toEqual(['id', 'price', 'customer', 'created', 'paid']);
    expect(again.widths()).toEqual({ customer: '220px' });
    const root = mount(() => <GridView grid={again} />);
    await tick();
    expect([...root.querySelectorAll('thead tr:first-child th')].map(th => th.textContent)).toEqual(['Číslo', 'Cena', 'Zákazník', 'Vytvořeno', 'Zaplaceno']);
    expect(root.querySelector('table')!.classList.contains('phx-grid-table-fixed')).toBe(true);
    expect(root.querySelector<HTMLElement>('th[data-col-key="customer"]')!.style.width).toBe('220px');
    again.resetColumns();
    expect(ordersGrid({ rows: ORDERS, remember: 'orders' }).visibleColumns()).toHaveLength(6);
  });

  test('Bootstrap: the classes of phloxcz/components-grid', async () => {
    const grid = ordersGrid();
    class Page extends Presenter {
      render() { return <GridView grid={grid} />; }
    }
    const { element } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    await tick();
    expect(element.querySelector('table')!.className).toBe('table table-hover table-bordered align-middle phx-grid-table');
    expect(element.querySelector('.pagination')!.className).toBe('pagination pagination-sm mb-0');
    expect(element.querySelector('th[data-col-key="customer"] input')!.className).toBe('form-control form-control-sm phx-grid-filter-input');
  });
});
