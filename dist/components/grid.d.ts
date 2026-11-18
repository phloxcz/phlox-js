/**
 * The data grid, like phloxcz/components-grid: columns, sorting, search, filters, pages, actions on rows,
 * actions on selected rows and totals. This is the model, <GridView> draws it.
 *
 * Data come from `load` with a query in the format of phloxcz/api-query (the format of Kendo UI),
 * or from `rows` in the browser, which are searched, filtered, sorted and paged here the same way.
 */
import type { Accessor, State } from '../reactive/reactive';
import type { Child } from '../ui/dom';
import type { Presenter } from '../ui/presenter';
import type { Items } from '../forms/controls';
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
    filter?: {
        logic: 'and';
        filters: GridCondition[];
    };
    /** Totals for the footer, as Kendo UI asks for them. */
    aggregate?: {
        field: string;
        aggregate: Aggregate;
    }[];
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
    /**
     * Sorting before the user picks another, e.g. the newest first: { field: 'createdStamp', dir: 'desc' }.
     * It is not in the URL, and clicking a column goes ascending, descending and back to it.
     */
    sort?: GridSort;
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
/** A column; the methods set it up and return it, like the rules of a form control. */
export declare class GridColumn<R> {
    readonly key: string;
    readonly label: string;
    readonly type: ColumnType;
    canSort: boolean;
    canSearch: boolean;
    canHide: boolean;
    filterKind: FilterKind | null;
    filterItems: [unknown, string][];
    dropDown: {
        search: (query: string) => Promise<Items<unknown>> | Items<unknown>;
        label?: (value: any) => Promise<string | null> | string | null;
    } | null;
    initialWidth: string | null;
    alignment: 'start' | 'end' | 'center' | null;
    aggregateFn: Aggregate | null;
    cellClass: string;
    renderer: ((row: R) => Child) | null;
    formatter: ((value: any) => string) | null;
    constructor(key: string, label: string, type: ColumnType);
    sortable(on?: boolean): this;
    /** Searched by the search field of the grid, with `rows`. On the server the API decides what is searched. */
    searchable(on?: boolean): this;
    /** A filter fitting the column: text, a range for numbers and dates, yes and no for a bool. */
    filterable(kind?: FilterKind): this;
    /** A filter with fixed choices. */
    filterSelect(items: Items<unknown>, multiple?: boolean): this;
    /** A filter with choices from the server, a DropDownList with search. `label` gives the label of a value from the URL. */
    filterDropDown(options: NonNullable<GridColumn<R>['dropDown']>): this;
    /** The starting width, e.g. '12rem'. The user can change it when the grid allows it. */
    width(width: string): this;
    align(alignment: 'start' | 'end' | 'center'): this;
    /** The column cannot be hidden. */
    alwaysVisible(): this;
    /** A total in the footer. */
    aggregate(fn: Aggregate): this;
    /** The text of a value: a number with its unit, a date in a format... */
    format(fn: (value: any) => string): this;
    /** The content of a cell, any template: a link, a badge... */
    render(fn: (row: R) => Child): this;
    class(className: string): this;
    /** The value of the column in a row. */
    value(row: R): unknown;
    /** A value as text, for a cell and for the footer. */
    text(value: unknown): string;
    /** A value from the URL as the type of the column: a number for a number, true or false for a bool. */
    typed(text: string): unknown;
    /** Conditions of the query for a filter as the user set it. */
    conditions(value: FilterValue): GridCondition[];
}
/** Searches, filters, sorts, counts and pages rows in the browser, by the same query as the server gets. */
export declare function applyQuery<R>(rows: readonly R[], query: GridQuery, searchIn?: string[]): GridResult<R>;
export declare class Grid<R extends object> {
    readonly options: GridOptions<R>;
    static texts: {
        search: string;
        reset: string;
        filter: string;
        all: string;
        yes: string;
        no: string;
        apply: string;
        from: string;
        to: string;
        clearFilter: string;
        noData: string;
        loading: string;
        shown: string;
        perPage: string;
        first: string;
        previous: string;
        next: string;
        last: string;
        page: string;
        columns: string;
        moveLeft: string;
        moveRight: string;
        selected: string;
        selectAll: string;
        selectRow: string;
        actions: string;
        sortBy: string;
        resize: string;
        sum: string;
        avg: string;
        count: string;
        min: string;
        max: string;
    };
    /**
     * Asks before an action with `confirm`. Null asks by the application: a popover at the button of the action
     * (see Application.confirm), or window.confirm() outside an application. An own question: Grid.confirm = (question, anchor) => ...
     */
    static confirm: ((question: string, anchor?: HTMLElement, danger?: boolean) => boolean | Promise<boolean>) | null;
    /** How <GridView> asks when Grid.confirm is null; set by the view to the confirm() of the application. */
    ask: (question: string, anchor?: HTMLElement, danger?: boolean) => boolean | Promise<boolean>;
    readonly columns: GridColumn<R>[];
    readonly actions: GridAction<R>[];
    readonly bulkActions: BulkAction<R>[];
    readonly page: State<number>;
    readonly pageSize: State<number>;
    readonly sort: State<GridSort | null>;
    readonly search: State<string>;
    readonly filters: State<Record<string, FilterValue>>;
    readonly rows: State<R[]>;
    readonly total: State<number>;
    readonly aggregates: State<Record<string, Partial<Record<Aggregate, number>>>>;
    readonly loading: State<boolean>;
    readonly selected: State<unknown[]>;
    readonly widths: State<Record<string, string>>;
    readonly order: State<string[]>;
    readonly hidden: State<string[]>;
    /** Columns in the order and visibility the user chose. */
    readonly visibleColumns: Accessor<GridColumn<R>[]>;
    readonly pages: Accessor<number>;
    private loads;
    private bound;
    private loaded;
    constructor(options?: GridOptions<R>);
    addColumn(key: keyof R & string, label: string, render?: (row: R) => Child): GridColumn<R>;
    addTextColumn(key: keyof R & string, label: string): GridColumn<R>;
    addNumberColumn(key: keyof R & string, label: string): GridColumn<R>;
    /** A date as text YYYY-MM-DD or a date and time in ISO 8601, as an API sends them. */
    addDateColumn(key: keyof R & string, label: string): GridColumn<R>;
    addBoolColumn(key: keyof R & string, label: string): GridColumn<R>;
    /** An action on a row: a link (`href`) or a function (`onClick`). Primary ones are buttons, the others are in a menu. */
    addAction(label: string, action: Omit<GridAction<R>, 'label'>): this;
    /** An action on the selected rows. Rows get checkboxes, the selection is kept across pages. */
    addBulkAction(label: string, run: BulkAction<R>['run'], options?: Omit<BulkAction<R>, 'label' | 'run'>): this;
    column(key: string): GridColumn<R> | undefined;
    keyOf(row: R): unknown;
    /** The query for the current state. */
    query(): GridQuery;
    /** Loads the rows for the current state. An older answer never overwrites a newer one. */
    load(): Promise<void>;
    /** Loads once, for the first drawing. */
    loadOnce(): Promise<void>;
    sortBy(key: string): Promise<void>;
    goTo(page: number): Promise<void>;
    setPageSize(size: number): Promise<void>;
    setSearch(text: string): Promise<void>;
    /** Sets the filter of a column; an empty value removes it. */
    setFilter(key: string, value: FilterValue | null): Promise<void>;
    /** Clears the search and all filters. */
    reset(): Promise<void>;
    private change;
    /**
     * Keeps the state in the URL of the presenter: ?page=2&sort=-name&q=text&f.state=open. Back and Forward
     * return it, a link shows the same. The parameters become persistent, so links of the presenter keep them.
     * Two grids on one page need a prefix: bind(this, 'orders-').
     */
    bind(presenter: Presenter<any, any>, prefix?: string): this;
    /**
     * Follows the URL of the bound presenter: called while drawing (by <GridView>), it reloads
     * whenever the parameters change.
     */
    follow(): void;
    private toParams;
    private fromParams;
    isSelected(row: R): boolean;
    toggleRow(row: R, on?: boolean): void;
    /** Selects or unselects all rows on the page. */
    togglePage(on: boolean): void;
    /** Runs an action on the selected rows, after a confirmation, then clears the selection and loads again. */
    runBulk(action: BulkAction<R>, anchor?: HTMLElement): Promise<void>;
    /** Runs an action on a row, after a confirmation. */
    runAction(action: GridAction<R>, row: R, anchor?: HTMLElement): Promise<boolean>;
    private question;
    setWidth(key: string, width: string): void;
    /** Moves a column before another one, or to the end with null. */
    moveColumn(key: string, before: string | null): void;
    /** Moves a column by one place, for the keyboard. */
    shiftColumn(key: string, by: -1 | 1): void;
    toggleColumn(key: string, show: boolean): void;
    /** Forgets the remembered columns. */
    resetColumns(): void;
    private localRows;
    private push;
    private layoutKey;
    private restoreLayout;
    private saveLayout;
}
