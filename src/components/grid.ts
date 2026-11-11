/**
 * The data grid, like phloxcz/components-grid: columns, sorting, search, filters, pages, actions on rows,
 * actions on selected rows and totals. This is the model, <GridView> draws it.
 *
 * Data come from `load` with a query in the format of phloxcz/api-query (the format of Kendo UI),
 * or from `rows` in the browser, which are searched, filtered, sorted and paged here the same way.
 */

import { batch, computed, effect, state, untrack } from '../reactive/reactive';
import type { Accessor, State } from '../reactive/reactive';
import type { Child } from '../ui/dom';
import type { LinkParams, Params, Presenter } from '../ui/presenter';
import { toPairs } from '../forms/controls';
import type { Items } from '../forms/controls';
import { foldText } from '../forms/listbox';

export type SortDir = 'asc' | 'desc';
export type Aggregate = 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface GridSort {
  field: string;
  dir: SortDir;
}

export interface GridCondition {
  field: string;
  operator: 'contains' | 'eq' | 'in' | 'gte' | 'lte';
  value: unknown;
}

/** A query as phloxcz/api-query takes it. */
export interface GridQuery {
  page: number;
  pageSize: number;
  sort: GridSort[];
  search?: string;
  filter?: { logic: 'and'; filters: GridCondition[] };
  /** Totals for the footer, as Kendo UI asks for them. */
  aggregate?: { field: string; aggregate: Aggregate }[];
}

/** One page of rows and the number of all, as phloxcz/api-query returns them. Totals as Kendo UI returns them. */
export interface GridResult<R> {
  data: R[];
  total: number;
  aggregates?: Record<string, Partial<Record<Aggregate, number>>>;
}

export type ColumnType = 'text' | 'number' | 'date' | 'bool' | 'custom';
export type FilterKind = 'text' | 'select' | 'multiSelect' | 'range' | 'bool' | 'dropDown';

/** A filter as the user set it, in texts, as it is in the URL too. A range is "from..to". */
export type FilterValue = string | string[];

export interface GridOptions<R> {
  /** Rows from the server, one page at a time. */
  load?: (query: GridQuery) => Promise<GridResult<R>>;
  /** All rows at once; the grid searches, filters, sorts and pages them itself. */
  rows?: R[] | Accessor<R[]>;
  /** The field that tells rows apart, for selection. 'id' by default. */
  key?: keyof R & string;
  pageSize?: number;
  /** Choices of the number of rows on a page. */
  pageSizes?: number[];
  /** Remembers the width, order and visibility of columns in the browser under this key. */
  remember?: string;
}

export interface GridAction<R> {
  label: string;
  /** A link: the action is an <a>. */
  href?: (row: R) => string;
  onClick?: (row: R) => void | Promise<void>;
  /** A button of its own; the other actions are in a menu. */
  primary?: boolean;
  danger?: boolean;
  /** Asked before the action, see Grid.confirm. */
  confirm?: string | ((row: R) => string);
  /** Shown only for some rows. */
  visible?: (row: R) => boolean;
}

export interface BulkAction<R> {
  label: string;
  run: (keys: unknown[], rows: R[]) => void | Promise<void>;
  danger?: boolean;
  confirm?: string;
}

const RANGE = '..';

/** A column; the methods set it up and return it, like the rules of a form control. */
export class GridColumn<R> {
  canSort = false;
  canSearch = false;
  canHide = true;
  filterKind: FilterKind | null = null;
  filterItems: [unknown, string][] = [];
  dropDown: { search: (query: string) => Promise<Items<unknown>> | Items<unknown>; label?: (value: any) => Promise<string | null> | string | null } | null = null;
  initialWidth: string | null = null;
  alignment: 'start' | 'end' | 'center' | null;
  aggregateFn: Aggregate | null = null;
  cellClass = '';
  renderer: ((row: R) => Child) | null = null;
  formatter: ((value: any) => string) | null = null;

  constructor(readonly key: string, readonly label: string, readonly type: ColumnType) {
    this.alignment = type === 'number' ? 'end' : type === 'bool' ? 'center' : null;
  }

  sortable(on = true): this {
    this.canSort = on;
    return this;
  }

  /** Searched by the search field of the grid, with `rows`. On the server the API decides what is searched. */
  searchable(on = true): this {
    this.canSearch = on;
    return this;
  }

  /** A filter fitting the column: text, a range for numbers and dates, yes and no for a bool. */
  filterable(kind: FilterKind = this.type === 'number' || this.type === 'date' ? 'range' : this.type === 'bool' ? 'bool' : 'text'): this {
    this.filterKind = kind;
    return this;
  }

  /** A filter with fixed choices. */
  filterSelect(items: Items<unknown>, multiple = false): this {
    this.filterKind = multiple ? 'multiSelect' : 'select';
    this.filterItems = toPairs(items);
    return this;
  }

  /** A filter with choices from the server, a DropDownList with search. `label` gives the label of a value from the URL. */
  filterDropDown(options: NonNullable<GridColumn<R>['dropDown']>): this {
    this.filterKind = 'dropDown';
    this.dropDown = options;
    return this;
  }

  /** The starting width, e.g. '12rem'. The user can change it when the grid allows it. */
  width(width: string): this {
    this.initialWidth = width;
    return this;
  }

  align(alignment: 'start' | 'end' | 'center'): this {
    this.alignment = alignment;
    return this;
  }

  /** The column cannot be hidden. */
  alwaysVisible(): this {
    this.canHide = false;
    return this;
  }

  /** A total in the footer. */
  aggregate(fn: Aggregate): this {
    this.aggregateFn = fn;
    return this;
  }

  /** The text of a value: a number with its unit, a date in a format... */
  format(fn: (value: any) => string): this {
    this.formatter = fn;
    return this;
  }

  /** The content of a cell, any template: a link, a badge... */
  render(fn: (row: R) => Child): this {
    this.renderer = fn;
    return this;
  }

  class(className: string): this {
    this.cellClass = className;
    return this;
  }

  /** The value of the column in a row. */
  value(row: R): unknown {
    return (row as Record<string, unknown>)[this.key];
  }

  /** A value as text, for a cell and for the footer. */
  text(value: unknown): string {
    if (this.formatter) return this.formatter(value);
    if (value === null || value === undefined || value === '') return '';
    if (this.type === 'number' && typeof value === 'number') return value.toLocaleString();
    if (this.type === 'date') {
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? String(value) : /T\d/.test(String(value)) ? date.toLocaleString() : date.toLocaleDateString();
    }
    return String(value);
  }

  /** A value from the URL as the type of the column: a number for a number, true or false for a bool. */
  typed(text: string): unknown {
    const item = this.filterItems.find(([value]) => String(value) === text);
    if (item) return item[0];
    if (this.type === 'number') return Number(text);
    if (this.type === 'bool') return text === '1' || text === 'true';
    return text;
  }

  /** Conditions of the query for a filter as the user set it. */
  conditions(value: FilterValue): GridCondition[] {
    const field = this.key;
    if (Array.isArray(value)) return value.length ? [{ field, operator: 'in', value: value.map(text => this.typed(text)) }] : [];
    if (value === '') return [];
    switch (this.filterKind) {
      case 'text':
        return [{ field, operator: 'contains', value }];
      case 'range': {
        const [from = '', to = ''] = value.split(RANGE);
        return [
          ...(from ? [{ field, operator: 'gte' as const, value: this.typed(from) }] : []),
          ...(to ? [{ field, operator: 'lte' as const, value: this.typed(to) }] : []),
        ];
      }
      default:
        return [{ field, operator: 'eq', value: this.typed(value) }];
    }
  }
}

/** Searches, filters, sorts, counts and pages rows in the browser, by the same query as the server gets. */
export function applyQuery<R>(rows: readonly R[], query: GridQuery, searchIn: string[] = []): GridResult<R> {
  const get = (row: R, field: string) => (row as Record<string, unknown>)[field];
  const words = foldText(query.search ?? '').split(/\s+/).filter(Boolean);
  const compare = (a: unknown, b: unknown): number => {
    if (a === b) return 0;
    if (a === null || a === undefined) return -1;
    if (b === null || b === undefined) return 1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
    return String(a).localeCompare(String(b));
  };
  const matches = (row: R, condition: GridCondition): boolean => {
    const value = get(row, condition.field);
    switch (condition.operator) {
      case 'contains': return foldText(String(value ?? '')).includes(foldText(String(condition.value)));
      case 'in': return (condition.value as unknown[]).some(item => compare(item, value) === 0);
      case 'gte': return value !== null && value !== undefined && compare(value, condition.value) >= 0;
      // A date as YYYY-MM-DD includes the whole day of a date and time
      case 'lte': return value !== null && value !== undefined && compare(typeof value === 'string' && typeof condition.value === 'string' ? value.slice(0, condition.value.length) : value, condition.value) <= 0;
      default: return compare(value, condition.value) === 0;
    }
  };

  let found = rows.filter(row =>
    words.every(word => searchIn.some(field => foldText(String(get(row, field) ?? '')).includes(word)))
    && (query.filter?.filters ?? []).every(condition => matches(row, condition)));
  for (const { field, dir } of [...query.sort].reverse()) {
    found = [...found].sort((a, b) => compare(get(a, field), get(b, field)) * (dir === 'desc' ? -1 : 1));
  }

  const aggregates: GridResult<R>['aggregates'] = {};
  for (const { field, aggregate } of query.aggregate ?? []) {
    const values = found.map(row => get(row, field)).filter((value): value is number => typeof value === 'number');
    const sum = values.reduce((total, value) => total + value, 0);
    const result = {
      sum, count: found.length, avg: values.length ? sum / values.length : 0,
      min: values.length ? Math.min(...values) : 0, max: values.length ? Math.max(...values) : 0,
    }[aggregate];
    (aggregates[field] ??= {})[aggregate] = result;
  }

  const start = (query.page - 1) * query.pageSize;
  return { data: found.slice(start, start + query.pageSize), total: found.length, aggregates };
}

interface Layout {
  widths: Record<string, string>;
  order: string[];
  hidden: string[];
}

export class Grid<R extends object> {
  static texts = {
    search: 'Search…', reset: 'Reset', filter: 'Filter', all: 'All', yes: 'Yes', no: 'No', apply: 'Apply',
    from: 'From', to: 'To', clearFilter: 'Clear the filter', noData: 'No records', loading: 'Loading…',
    shown: '%d–%d of %d', perPage: 'Rows on a page', first: 'First page', previous: 'Previous page',
    next: 'Next page', last: 'Last page', page: 'Page %d', columns: 'Columns', moveLeft: 'Move left',
    moveRight: 'Move right', selected: 'Selected: %d', selectAll: 'Select all on the page', selectRow: 'Select the row',
    actions: 'Actions', sortBy: 'Sort by %s', resize: 'Change the width of %s',
    sum: 'Total', avg: 'Average', count: 'Count', min: 'Minimum', max: 'Maximum',
  };

  /**
   * Asks before an action with `confirm`. Null asks by the application: a popover at the button of the action
   * (see Application.confirm), or window.confirm() outside an application. An own question: Grid.confirm = (question, anchor) => ...
   */
  static confirm: ((question: string, anchor?: HTMLElement, danger?: boolean) => boolean | Promise<boolean>) | null = null;

  /** How <GridView> asks when Grid.confirm is null; set by the view to the confirm() of the application. */
  ask: (question: string, anchor?: HTMLElement, danger?: boolean) => boolean | Promise<boolean> = question => window.confirm(question);

  readonly columns: GridColumn<R>[] = [];
  readonly actions: GridAction<R>[] = [];
  readonly bulkActions: BulkAction<R>[] = [];

  // What the user is looking at, also in the URL when the grid is bound to a presenter
  readonly page = state(1);
  readonly pageSize: State<number>;
  readonly sort = state<GridSort | null>(null);
  readonly search = state('');
  readonly filters = state<Record<string, FilterValue>>({});

  // What came
  readonly rows = state<R[]>([]);
  readonly total = state(0);
  readonly aggregates = state<NonNullable<GridResult<R>['aggregates']>>({});
  readonly loading = state(false);
  readonly selected = state<unknown[]>([]);

  // How the user likes the columns, remembered with `remember`
  readonly widths = state<Record<string, string>>({});
  readonly order = state<string[]>([]);
  readonly hidden = state<string[]>([]);

  /** Columns in the order and visibility the user chose. */
  readonly visibleColumns = computed(() => {
    const order = this.order();
    const position = (column: GridColumn<R>) => (order.includes(column.key) ? order.indexOf(column.key) : order.length + this.columns.indexOf(column));
    return [...this.columns].sort((a, b) => position(a) - position(b)).filter(column => !this.hidden().includes(column.key));
  });

  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  private loads = 0;
  private bound: { presenter: Presenter<any, any>; prefix: string } | null = null;
  private loaded = false;

  constructor(readonly options: GridOptions<R> = {}) {
    this.pageSize = state(options.pageSize ?? 20);
    this.restoreLayout();
  }

  addColumn(key: keyof R & string, label: string, render?: (row: R) => Child): GridColumn<R> {
    const column = new GridColumn<R>(key, label, render ? 'custom' : 'text');
    if (render) column.render(render);
    this.columns.push(column);
    return column;
  }

  addTextColumn(key: keyof R & string, label: string): GridColumn<R> {
    return this.push(new GridColumn<R>(key, label, 'text'));
  }

  addNumberColumn(key: keyof R & string, label: string): GridColumn<R> {
    return this.push(new GridColumn<R>(key, label, 'number'));
  }

  /** A date as text YYYY-MM-DD or a date and time in ISO 8601, as an API sends them. */
  addDateColumn(key: keyof R & string, label: string): GridColumn<R> {
    return this.push(new GridColumn<R>(key, label, 'date'));
  }

  addBoolColumn(key: keyof R & string, label: string): GridColumn<R> {
    return this.push(new GridColumn<R>(key, label, 'bool'));
  }

  /** An action on a row: a link (`href`) or a function (`onClick`). Primary ones are buttons, the others are in a menu. */
  addAction(label: string, action: Omit<GridAction<R>, 'label'>): this {
    this.actions.push({ label, ...action });
    return this;
  }

  /** An action on the selected rows. Rows get checkboxes, the selection is kept across pages. */
  addBulkAction(label: string, run: BulkAction<R>['run'], options: Omit<BulkAction<R>, 'label' | 'run'> = {}): this {
    this.bulkActions.push({ label, run, ...options });
    return this;
  }

  column(key: string): GridColumn<R> | undefined {
    return this.columns.find(column => column.key === key);
  }

  keyOf(row: R): unknown {
    return (row as Record<string, unknown>)[this.options.key ?? 'id'];
  }

  /** The query for the current state. */
  query(): GridQuery {
    const sort = this.sort();
    const conditions = Object.entries(this.filters()).flatMap(([key, value]) => this.column(key)?.conditions(value) ?? []);
    const aggregate = this.columns.filter(column => column.aggregateFn).map(column => ({ field: column.key, aggregate: column.aggregateFn! }));
    return {
      page: this.page(),
      pageSize: this.pageSize(),
      sort: sort ? [sort] : [],
      ...(this.search() ? { search: this.search() } : {}),
      ...(conditions.length ? { filter: { logic: 'and' as const, filters: conditions } } : {}),
      ...(aggregate.length ? { aggregate } : {}),
    };
  }

  /** Loads the rows for the current state. An older answer never overwrites a newer one. */
  async load(): Promise<void> {
    this.loaded = true;
    const query = untrack(() => this.query());
    const ticket = ++this.loads;
    this.loading.set(true);
    try {
      const result = this.options.load
        ? await this.options.load(query)
        : applyQuery(untrack(() => this.localRows()), query, this.columns.filter(column => column.canSearch).map(column => column.key));
      if (ticket !== this.loads) return;
      // A page past the end, e.g. after deleting rows, goes to the last one
      const last = Math.max(1, Math.ceil(result.total / query.pageSize));
      if (query.page > last && result.total > 0) return this.change({ page: last });
      batch(() => {
        this.rows.set(result.data);
        this.total.set(result.total);
        this.aggregates.set(result.aggregates ?? {});
      });
    } finally {
      if (ticket === this.loads) this.loading.set(false);
    }
  }

  /** Loads once, for the first drawing. */
  loadOnce(): Promise<void> {
    return this.loaded ? Promise.resolve() : this.load();
  }

  // Changes by the user. When bound to a presenter, they go through the URL, so Back returns them.

  sortBy(key: string): Promise<void> {
    // Three states as in phloxcz/components-grid: ascending, descending, none
    const sort = untrack(this.sort);
    const next = sort?.field !== key ? { field: key, dir: 'asc' as const } : sort.dir === 'asc' ? { field: key, dir: 'desc' as const } : null;
    return this.change({ sort: next, page: 1 });
  }

  goTo(page: number): Promise<void> {
    return this.change({ page: Math.min(Math.max(1, page), untrack(this.pages)) });
  }

  setPageSize(size: number): Promise<void> {
    return this.change({ pageSize: size, page: 1 });
  }

  setSearch(text: string): Promise<void> {
    return this.change({ search: text.trim(), page: 1 });
  }

  /** Sets the filter of a column; an empty value removes it. */
  setFilter(key: string, value: FilterValue | null): Promise<void> {
    const filters = { ...untrack(this.filters) };
    if (value === null || value === '' || (Array.isArray(value) && !value.length) || value === RANGE) delete filters[key];
    else filters[key] = value;
    return this.change({ filters, page: 1 });
  }

  /** Clears the search and all filters. */
  reset(): Promise<void> {
    return this.change({ search: '', filters: {}, page: 1 });
  }

  private change(patch: Partial<{ page: number; pageSize: number; sort: GridSort | null; search: string; filters: Record<string, FilterValue> }>): Promise<void> {
    if (this.bound) {
      const { presenter } = this.bound;
      const current = untrack(() => ({ page: this.page(), pageSize: this.pageSize(), sort: this.sort(), search: this.search(), filters: this.filters() }));
      return presenter.app.router.navigate(presenter.link('this', this.toParams({ ...current, ...patch })));
    }
    batch(() => {
      if (patch.page !== undefined) this.page.set(patch.page);
      if (patch.pageSize !== undefined) this.pageSize.set(patch.pageSize);
      if (patch.sort !== undefined) this.sort.set(patch.sort);
      if (patch.search !== undefined) this.search.set(patch.search);
      if (patch.filters !== undefined) this.filters.set(patch.filters);
    });
    return this.load();
  }

  // The URL

  /**
   * Keeps the state in the URL of the presenter: ?page=2&sort=-name&q=text&f.state=open. Back and Forward
   * return it, a link shows the same. The parameters become persistent, so links of the presenter keep them.
   * Two grids on one page need a prefix: bind(this, 'orders-').
   */
  bind(presenter: Presenter<any, any>, prefix = ''): this {
    this.bound = { presenter, prefix };
    presenter.persistent.push(`${prefix}page`, `${prefix}size`, `${prefix}sort`, `${prefix}q`, `${prefix}f.*`);
    return this;
  }

  /**
   * Follows the URL of the bound presenter: called while drawing (by <GridView>), it reloads
   * whenever the parameters change.
   */
  follow(): void {
    if (!this.bound) return;
    const { presenter } = this.bound;
    let last = '';
    effect(() => {
      const params = presenter.params();
      untrack(() => {
        this.fromParams(params);
        const key = JSON.stringify(this.query());
        if (key === last && this.loaded) return;
        last = key;
        void this.load();
      });
    });
  }

  private toParams(state: { page: number; pageSize: number; sort: GridSort | null; search: string; filters: Record<string, FilterValue> }): LinkParams {
    const p = this.bound?.prefix ?? '';
    const params: LinkParams = {
      [`${p}page`]: state.page > 1 ? state.page : null,
      [`${p}size`]: state.pageSize !== (this.options.pageSize ?? 20) ? state.pageSize : null,
      [`${p}sort`]: state.sort ? `${state.sort.dir === 'desc' ? '-' : ''}${state.sort.field}` : null,
      [`${p}q`]: state.search || null,
    };
    // Filters not set now are removed from the URL
    for (const column of this.columns) params[`${p}f.${column.key}`] = null;
    for (const [key, value] of Object.entries(state.filters)) params[`${p}f.${key}`] = Array.isArray(value) ? value.join(',') : value;
    return params;
  }

  private fromParams(params: Params): void {
    const p = this.bound?.prefix ?? '';
    const sort = params[`${p}sort`] ?? '';
    const filters: Record<string, FilterValue> = {};
    for (const column of this.columns) {
      const value = params[`${p}f.${column.key}`];
      if (value) filters[column.key] = column.filterKind === 'multiSelect' ? value.split(',') : value;
    }
    batch(() => {
      this.page.set(Math.max(1, Number(params[`${p}page`]) || 1));
      this.pageSize.set(Number(params[`${p}size`]) || (this.options.pageSize ?? 20));
      this.sort.set(sort ? { field: sort.replace(/^-/, ''), dir: sort.startsWith('-') ? 'desc' : 'asc' } : null);
      this.search.set(params[`${p}q`] ?? '');
      this.filters.set(filters);
    });
  }

  // Selection

  isSelected(row: R): boolean {
    return this.selected().includes(this.keyOf(row));
  }

  toggleRow(row: R, on = !untrack(() => this.isSelected(row))): void {
    const key = this.keyOf(row);
    this.selected.update(keys => (on ? [...keys.filter(other => other !== key), key] : keys.filter(other => other !== key)));
  }

  /** Selects or unselects all rows on the page. */
  togglePage(on: boolean): void {
    const keys = untrack(this.rows).map(row => this.keyOf(row));
    this.selected.update(selected => (on ? [...selected.filter(key => !keys.includes(key)), ...keys] : selected.filter(key => !keys.includes(key))));
  }

  /** Runs an action on the selected rows, after a confirmation, then clears the selection and loads again. */
  async runBulk(action: BulkAction<R>, anchor?: HTMLElement): Promise<void> {
    const keys = untrack(this.selected);
    if (!keys.length || (action.confirm && !(await this.question(action.confirm, anchor, action.danger)))) return;
    const rows = untrack(this.rows).filter(row => keys.includes(this.keyOf(row)));
    await action.run(keys, rows);
    this.selected.set([]);
    await this.load();
  }

  /** Runs an action on a row, after a confirmation. */
  async runAction(action: GridAction<R>, row: R, anchor?: HTMLElement): Promise<boolean> {
    const question = typeof action.confirm === 'function' ? action.confirm(row) : action.confirm;
    if (question && !(await this.question(question, anchor, action.danger))) return false;
    await action.onClick?.(row);
    return true;
  }

  private question(text: string, anchor?: HTMLElement, danger?: boolean): boolean | Promise<boolean> {
    return (Grid.confirm ?? this.ask)(text, anchor, danger);
  }

  // Columns

  setWidth(key: string, width: string): void {
    this.widths.update(widths => ({ ...widths, [key]: width }));
    this.saveLayout();
  }

  /** Moves a column before another one, or to the end with null. */
  moveColumn(key: string, before: string | null): void {
    const keys = untrack(this.visibleColumns).map(column => column.key);
    const all = [...keys, ...this.columns.map(column => column.key).filter(other => !keys.includes(other))].filter(other => other !== key);
    all.splice(before === null ? keys.length - 1 : all.indexOf(before), 0, key);
    this.order.set(all);
    this.saveLayout();
  }

  /** Moves a column by one place, for the keyboard. */
  shiftColumn(key: string, by: -1 | 1): void {
    const keys = untrack(this.visibleColumns).map(column => column.key);
    const at = keys.indexOf(key) + by;
    if (at < 0 || at >= keys.length) return;
    this.moveColumn(key, by < 0 ? keys[at]! : (keys[at + 1] ?? null));
  }

  toggleColumn(key: string, show: boolean): void {
    this.hidden.update(hidden => (show ? hidden.filter(other => other !== key) : [...hidden.filter(other => other !== key), key]));
    this.saveLayout();
  }

  /** Forgets the remembered columns. */
  resetColumns(): void {
    batch(() => {
      this.widths.set({});
      this.order.set([]);
      this.hidden.set([]);
    });
    this.saveLayout();
  }

  private localRows(): R[] {
    const rows = this.options.rows ?? [];
    return typeof rows === 'function' ? rows() : rows;
  }

  private push(column: GridColumn<R>): GridColumn<R> {
    this.columns.push(column);
    return column;
  }

  private layoutKey(): string | null {
    return this.options.remember ? `phlox-grid:${this.options.remember}` : null;
  }

  private restoreLayout(): void {
    const key = this.layoutKey();
    if (!key) return;
    try {
      const layout = JSON.parse(localStorage.getItem(key) ?? 'null') as Layout | null;
      if (!layout) return;
      this.widths.set(layout.widths ?? {});
      this.order.set(layout.order ?? []);
      this.hidden.set(layout.hidden ?? []);
    } catch {
      // A broken or blocked storage means the columns as defined
    }
  }

  private saveLayout(): void {
    const key = this.layoutKey();
    if (!key) return;
    const layout: Layout = untrack(() => ({ widths: this.widths(), order: this.order(), hidden: this.hidden() }));
    try {
      localStorage.setItem(key, JSON.stringify(layout));
    } catch {
      // Not remembered, the grid still works
    }
  }
}
