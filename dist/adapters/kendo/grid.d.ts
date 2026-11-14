/**
 * <KendoGrid>: Kendo Grid with its rows from state, and cells that can be templates of the framework
 * (links, components) instead of HTML strings of Kendo.
 */
import type { Accessor } from '../../reactive/reactive';
import type { Child } from '../../ui/dom';
import { Component } from '../../ui/component';
import { Kendo } from './kendo';
import type { KendoWidgetInstance } from './kendo';
/** The part of Kendo Grid the adapter uses. */
export interface KendoGridInstance extends KendoWidgetInstance {
    dataSource: {
        data(items?: object[]): unknown;
    };
    dataItem(row: Element): Record<string, unknown> | undefined;
    select(): ArrayLike<Element>;
}
/** A column as in Kendo, with `render` for a cell made by a template of the framework. */
export interface KendoGridColumn<T> {
    field?: string;
    title?: string;
    width?: number | string;
    /** The content of the cell: <a href={this.link(…)}>…</a>, a component… Instead of `template` of Kendo. */
    render?: (row: T) => Child;
    [option: string]: unknown;
}
export interface KendoGridProps<T> {
    columns: KendoGridColumn<T>[];
    /** The rows. A change of the state shows the new rows, the grid keeps its sorting, paging and filters. */
    data?: Accessor<readonly T[]>;
    /** Other options of Kendo Grid: sortable, pageable, filterable, height… `dataSource` without `data`. */
    options?: Record<string, any>;
    /** With `options.selectable`: the row the user chose, as the object from `data`. */
    onSelect?: (row: T | null) => void;
    onCreate?: (grid: KendoGridInstance) => void;
    class?: string;
}
export declare class KendoGrid<T extends object> extends Component<KendoGridProps<T>> {
    private kendo;
    static $inject: () => (typeof Kendo)[];
    grid: KendoGridInstance | null;
    private host;
    /** Scopes of cells made by `render`, cleaned up before every new drawing of the rows. */
    private cells;
    constructor(kendo: Kendo);
    render(): Child;
    afterRender(): void;
    /** The object from `data` behind a row of Kendo. */
    original(item: Record<string, unknown> | undefined): T | null;
    private renderCells;
    private clearCells;
}
