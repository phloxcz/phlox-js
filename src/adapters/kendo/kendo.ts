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

export class Kendo {
  constructor(readonly kendo: KendoLike) {}

  /** Makes a widget, e.g. create('DatePicker', input, { format: 'd. M. yyyy' }). */
  create<W extends object = KendoWidgetInstance>(name: string, element: HTMLElement, options: object = {}): W {
    const Widget = this.kendo.ui[name] as (new (element: HTMLElement, options: object) => W) | undefined;
    if (typeof Widget !== 'function') throw new Error(`Kendo UI has no widget '${name}', is it loaded?`);
    return new Widget(element, options);
  }
}

/** Whether two values of a widget are the same: dates by time, lists by content. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
  // Kendo gives null and '' for an empty value, both mean nothing
  return (a === null || a === undefined || a === '') && (b === null || b === undefined || b === '');
}
