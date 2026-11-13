/**
 * <KendoWidget>: any widget of Kendo UI in a template, bound to state both ways, like knockout-kendo.
 * The widget is made once the element is in the page and destroyed when its part of the template goes away.
 */

import { effect, untrack } from '../../reactive/reactive';
import type { State } from '../../reactive/reactive';
import type { Reactive } from '../../ui/dom';
import { Component } from '../../ui/component';
import { Kendo, sameValue } from './kendo';
import type { KendoWidgetInstance } from './kendo';

/** Widgets made on an <input>; the others on a <div>. */
const INPUTS = new Set([
  'AutoComplete', 'ColorPicker', 'ComboBox', 'DateInput', 'DatePicker', 'DateRangePicker', 'DateTimePicker',
  'DropDownList', 'MaskedTextBox', 'MultiColumnComboBox', 'MultiSelect', 'NumericTextBox', 'Switch', 'TextBox',
  'TimePicker', 'Rating', 'CheckBox', 'RadioButton', 'TextArea', 'Slider',
]);

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

export class KendoWidget<W extends KendoWidgetInstance = KendoWidgetInstance> extends Component<KendoWidgetProps<W>> {
  static $inject = () => [Kendo];

  /** The widget, null until the element is in the page. */
  widget: W | null = null;
  private host!: HTMLElement;

  constructor(private kendo: Kendo) {
    super();
  }

  render() {
    // Kendo wraps its element in its own elements; ours is only the host, so nothing of Kendo is left behind
    return <span class={() => ['phlox-kendo', read(this.props.class)].filter(Boolean).join(' ')} ref={element => { this.host = element; }} />;
  }

  override afterRender() {
    const { props } = this;
    const element = document.createElement(props.tag ?? (INPUTS.has(props.widget) ? 'input' : 'div'));
    if (props.id) element.id = props.id;
    if (props.name) element.setAttribute('name', props.name);
    this.host.append(element);

    const widget = this.widget = this.kendo.create<W>(props.widget, element, props.options ?? {});
    this.scope.onCleanup(() => {
      widget.destroy();
      this.host.replaceChildren();
    });

    const { value, enabled } = props;
    this.scope.run(() => {
      if (value && widget.value) {
        widget.bind('change', () => value.set(widget.value!()));
        effect(() => {
          const next = value();
          if (!sameValue(untrack(() => widget.value!()), next)) widget.value!(next);
        });
      }
      if (enabled !== undefined && widget.enable) effect(() => widget.enable!(Boolean(read(enabled))));
    });
    props.onCreate?.(widget, element);
  }
}

function read<T>(value: Reactive<T> | undefined): T | undefined {
  return typeof value === 'function' ? (value as () => T)() : value;
}
