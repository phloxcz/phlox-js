/**
 * Drawing of a Grid with the HTML and classes of phloxcz/components-grid: a toolbar with search and columns,
 * a bar for selected rows, the table with sorting, filters, actions and totals, and pages below it.
 */
import type { Child } from '../ui/dom';
import { Grid } from './grid';
export interface GridViewProps<R extends object> {
    grid: Grid<R>;
    /** The search field above the table. */
    search?: boolean;
    /** Columns can be made wider or narrower by dragging the edge of a header. */
    resizable?: boolean;
    /** Columns can be moved by dragging a header. */
    reorderable?: boolean;
    /** A menu to hide, show and move columns. */
    columnToggle?: boolean;
    'aria-label'?: string;
    class?: string;
}
export declare function GridView<R extends object>(props: GridViewProps<R>): Child;
