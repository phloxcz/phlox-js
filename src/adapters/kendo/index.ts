/**
 * Adapter for Kendo UI (for jQuery), like knockout-kendo for Knockout: widgets bound to state, destroyed
 * with their part of the template, Kendo Grid, dialogs in Kendo Window and widgets as controls of forms.
 * phlox-js does not import Kendo, the application passes it in: services.add(new Kendo(kendo)).
 * The CSS of the adapter: import 'phlox-js/adapters/kendo/kendo.css'.
 */

export { Kendo, sameValue } from './kendo';
export type { KendoLike, KendoWidgetInstance } from './kendo';
export { KendoWidget } from './widget';
export type { KendoWidgetProps } from './widget';
export { KendoGrid } from './grid';
export type { KendoGridColumn, KendoGridInstance, KendoGridProps } from './grid';
export { KendoDialogs } from './dialogs';
export type { KendoWindowInstance } from './dialogs';
export { KendoControl } from './control';
