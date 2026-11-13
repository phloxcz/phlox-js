/**
 * KendoControl: a widget of Kendo UI as a control of a form. Rules, <Label>, <InputError>, errors from
 * the server and values work as with the controls of the framework:
 *
 *   form.addControl('due', new KendoControl<Date | null>('DatePicker', 'Termín', { format: 'd. M. yyyy' }))
 *     .setRequired('Vyberte termín.');
 */

import { state, untrack } from '../../reactive/reactive';
import type { State } from '../../reactive/reactive';
import type { Child } from '../../ui/dom';
import { FormControl } from '../../forms/controls';
import type { ExtraAttributes } from '../../forms/controls';
import { KendoWidget } from './widget';

export class KendoControl<T> extends FormControl<T | null> {
  private readonly current = state<T | null>(null);

  /**
   * @param widget the name in kendo.ui, a widget with value(): 'DatePicker', 'DropDownList', 'NumericTextBox'…
   * @param options options of the widget, as in Kendo documentation
   */
  constructor(private widget: string, label = '', private options: object = {}) {
    super(label);
  }

  getValue(): T | null {
    return this.current();
  }

  setValue(value: T | null): void {
    this.current.set(value ?? null);
  }

  isFilled(): boolean {
    const value = this.current();
    return value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);
  }

  render(attributes: ExtraAttributes): Child {
    const { id, name, onBlur } = this.attrs();
    // A change in the widget is a change by the user: the rules are checked as with other controls
    const value: State<T | null> = Object.assign(() => this.current(), {
      set: (next: T | null) => {
        this.current.set(next ?? null);
        this.changed();
      },
      update: (change: (value: T | null) => T | null) => value.set(change(untrack(this.current))),
    });
    let host: HTMLElement | null = null;
    return (
      <span
        class="phlox-kendo-control"
        ref={element => { host = element; }}
        // Leaving the whole widget, not its inner parts (the popup of a date picker…)
        onFocusout={event => {
          if (host?.contains(event.relatedTarget as Node | null)) return;
          (onBlur as (event: FocusEvent) => void)(event);
        }}
      >
        <KendoWidget
          widget={this.widget}
          options={this.options}
          value={value}
          id={id as string}
          name={name as string}
          enabled={() => !this.disabled()}
          class={this.classFor(attributes, 'kendo')}
          onCreate={(_widget, element) => { this.element = element; }}
        />
      </span>
    );
  }
}
