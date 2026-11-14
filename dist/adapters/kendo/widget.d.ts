/**
 * <KendoWidget>: any widget of Kendo UI in a template, bound to state both ways, like knockout-kendo.
 * The widget is made once the element is in the page and destroyed when its part of the template goes away.
 */
import type { State } from '../../reactive/reactive';
import type { Reactive } from '../../ui/dom';
import { Component } from '../../ui/component';
import { Kendo } from './kendo';
import type { KendoWidgetInstance } from './kendo';
export interface KendoWidgetProps<W extends KendoWidgetInstance = KendoWidgetInstance> {
    /** The name of the widget in kendo.ui: 'DatePicker', 'DropDownList', 'Editor'… */
    widget: string;
    /** Options of the widget, as in Kendo documentation. Read once, when the widget is made. */
    options?: object;
    /** The value, both ways: the state sets the widget, a change in the widget sets the state. */
    value?: State<any>;
    /** Whether the user can use the widget. */
    enabled?: Reactive<boolean>;
    /** The element the widget is made on, by default an <input> for widgets of values, a <div> for the others. */
    tag?: 'input' | 'div' | 'select' | 'textarea' | 'span';
    id?: string | null;
    name?: string | null;
    /** Classes of the element around the widget. */
    class?: Reactive<string | null | undefined>;
    /** The widget once it exists, for its own methods and events. */
    onCreate?: (widget: W, element: HTMLElement) => void;
}
export declare class KendoWidget<W extends KendoWidgetInstance = KendoWidgetInstance> extends Component<KendoWidgetProps<W>> {
    private kendo;
    static $inject: () => (typeof Kendo)[];
    /** The widget, null until the element is in the page. */
    widget: W | null;
    private host;
    constructor(kendo: Kendo);
    render(): import("../..").Child;
    afterRender(): void;
}
