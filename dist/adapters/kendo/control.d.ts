/**
 * KendoControl: a widget of Kendo UI as a control of a form. Rules, <Label>, <InputError>, errors from
 * the server and values work as with the controls of the framework:
 *
 *   form.addControl('due', new KendoControl<Date | null>('DatePicker', 'Termín', { format: 'd. M. yyyy' }))
 *     .setRequired('Vyberte termín.');
 */
import type { Child } from '../../ui/dom';
import { FormControl } from '../../forms/controls';
import type { ExtraAttributes } from '../../forms/controls';
export declare class KendoControl<T> extends FormControl<T | null> {
    private widget;
    private options;
    private readonly current;
    /**
     * @param widget the name in kendo.ui, a widget with value(): 'DatePicker', 'DropDownList', 'NumericTextBox'…
     * @param options options of the widget, as in Kendo documentation
     */
    constructor(widget: string, label?: string, options?: object);
    getValue(): T | null;
    setValue(value: T | null): void;
    isFilled(): boolean;
    render(attributes: ExtraAttributes): Child;
}
