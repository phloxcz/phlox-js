/**
 * <KendoGrid>: Kendo Grid with its rows from state, and cells that can be templates of the framework
 * (links, components) instead of HTML strings of Kendo.
 */

import { Scope, effect, untrack } from '../../reactive/reactive';
import type { Accessor } from '../../reactive/reactive';
import { insert } from '../../ui/dom';
import type { Child } from '../../ui/dom';
import { Component } from '../../ui/component';
import { Kendo } from './kendo';
import type { KendoWidgetInstance } from './kendo';

/** The part of Kendo Grid the adapter uses. */
export interface KendoGridInstance extends KendoWidgetInstance {
  dataSource: { data(items?: object[]): unknown };
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

/** The index of the row in `data`, kept in the copies Kendo makes, to give back the original objects. */
const INDEX = '__phloxRow';

export class KendoGrid<T extends object> extends Component<KendoGridProps<T>> {
  static $inject = () => [Kendo];

  grid: KendoGridInstance | null = null;
  private host!: HTMLElement;
  /** Scopes of cells made by `render`, cleaned up before every new drawing of the rows. */
  private cells: Scope[] = [];

  constructor(private kendo: Kendo) {
    super();
  }

  render() {
    return <div class={['phlox-kendo-grid', this.props.class].filter(Boolean).join(' ')} ref={element => { this.host = element; }} />;
  }

  override afterRender() {
    const { columns, data, options = {} } = this.props;
    const element = document.createElement('div');
    this.host.append(element);
    const rowsOf = (items: readonly T[]) => items.map((item, index) => ({ ...item, [INDEX]: index }));

    const grid = this.grid = this.kendo.create<KendoGridInstance>('Grid', element, {
      ...options,
      ...(data ? { dataSource: { ...options.dataSource, data: rowsOf(untrack(data)) } } : {}),
      columns: columns.map((column, index) => {
        if (!column.render) return column;
        const { render: _render, ...rest } = column;
        return { ...rest, template: () => `<span data-phlox-cell="${index}"></span>` };
      }),
      dataBound: (event: unknown) => {
        // The first drawing comes from the constructor, before `grid` is assigned
        this.renderCells(this.grid);
        options.dataBound?.(event);
      },
    });
    this.scope.onCleanup(() => {
      this.clearCells();
      grid.destroy();
      this.host.replaceChildren();
    });
    this.renderCells(grid);

    if (data) this.scope.run(() => effect(() => void grid.dataSource.data(rowsOf(data()))));
    if (this.props.onSelect) {
      grid.bind('change', () => {
        const row = grid.select()[0];
        this.props.onSelect!(row ? this.original(grid.dataItem(row)) : null);
      });
    }
    this.props.onCreate?.(grid);
  }

  /** The object from `data` behind a row of Kendo. */
  original(item: Record<string, unknown> | undefined): T | null {
    const index = item?.[INDEX];
    return typeof index === 'number' ? untrack(this.props.data!)[index] ?? null : null;
  }

  private renderCells(grid: KendoGridInstance | null): void {
    if (!grid || !this.props.columns.some(column => column.render)) return;
    this.clearCells();
    for (const cell of this.host.querySelectorAll<HTMLElement>('[data-phlox-cell]')) {
      const row = this.original(grid.dataItem(cell.closest('tr')!));
      const column = this.props.columns[Number(cell.dataset.phloxCell)];
      if (!row || !column?.render) continue;
      const scope = new Scope(this.scope);
      this.cells.push(scope);
      scope.run(() => insert(cell, untrack(() => column.render!(row)), null));
    }
  }

  private clearCells(): void {
    for (const scope of this.cells.splice(0)) scope.dispose();
  }
}
