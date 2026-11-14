/** Rendering of forms: automatic <FormView>, or by hand with <FormTag>, <Label>, <Input> and <InputError>. */
import type { Child } from '../ui/dom';
import type { ElementProps } from '../ui/jsx';
import { FormControl } from './controls';
import type { Container } from './container';
import { Multiplier } from './multiplier';
import type { Form } from './form';
/** The <form> element, like {form} in Latte. Sending it validates the form and calls onSuccess. */
export declare function FormTag(props: {
    form: Form<any>;
    children?: Child;
} & Omit<ElementProps<HTMLFormElement>, 'children' | 'ref'>): Child;
/** Like {label name} in Latte. A required control has the class `required`. */
export declare function Label(props: {
    control: FormControl<any>;
    children?: Child;
}): Child;
/**
 * Like {input name} in Latte. Other attributes go to the element: <Input control={...} class="wide" />.
 * `ref` gets the element the user works with (control.element), the control keeps its own reference too.
 */
export declare function Input(props: {
    control: FormControl<any>;
} & Record<string, unknown>): Child;
/** Like {inputError name} in Latte: the error of the control, shown only while there is one. */
export declare function InputError(props: {
    control: FormControl<any>;
}): Child;
/** Errors of the whole form, e.g. from the server. */
export declare function FormErrors(props: {
    form: Form<any>;
}): Child;
/**
 * The whole form, like {control form} in Latte. Every control gets a row with the id `<control id>-pair`,
 * which toggle() can use. Containers become groups, multipliers rows that can be added and ordered.
 */
export declare function FormView(props: {
    form: Form<any>;
} & Omit<ElementProps<HTMLFormElement>, 'children' | 'ref'>): Child;
/** Errors of the rows as a whole, e.g. too few of them. */
export declare function MultiplierErrors(props: {
    multiplier: Multiplier<any>;
}): Child;
/**
 * Rows of a multiplier with buttons to add, remove and move them, and a handle to drag them.
 * Without children every row shows its controls with labels. With children the row is drawn by them:
 * <MultiplierView multiplier={lines}>{row => <Input control={row.get('name')} />}</MultiplierView>.
 */
export declare function MultiplierView<R extends object>(props: {
    multiplier: Multiplier<R>;
    children?: (row: Container<R>, index: () => number) => Child;
}): Child;
