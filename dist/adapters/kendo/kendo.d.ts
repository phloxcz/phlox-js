/**
 * The service through which the adapter reaches Kendo UI. The application passes the `kendo` object in,
 * phlox-js does not import Kendo nor jQuery:
 *
 *   import jQuery from 'jquery';
 *   window.jQuery = window.$ = jQuery;
 *   const { default: kendo } = await import('@progress/kendo-ui');
 *   services.add(new Kendo(kendo));
 */
/** The part of a Kendo widget the adapter uses. Every widget has these, some have value() and enable(). */
export interface KendoWidgetInstance {
    /** jQuery of the element the widget was made on. */
    element: ArrayLike<HTMLElement>;
    destroy(): void;
    bind(event: string, handler: (event: any) => void): void;
    value?(value?: unknown): unknown;
    enable?(enabled: boolean): void;
}
/** The part of the `kendo` object the adapter uses: constructors of widgets by name. */
export interface KendoLike {
    ui: Record<string, unknown>;
}
export declare class Kendo {
    readonly kendo: KendoLike;
    constructor(kendo: KendoLike);
    /** Makes a widget, e.g. create('DatePicker', input, { format: 'd. M. yyyy' }). */
    create<W extends object = KendoWidgetInstance>(name: string, element: HTMLElement, options?: object): W;
}
/** Whether two values of a widget are the same: dates by time, lists by content. */
export declare function sameValue(a: unknown, b: unknown): boolean;
