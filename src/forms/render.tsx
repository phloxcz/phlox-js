/** Rendering of forms: automatic <FormView>, or by hand with <FormTag>, <Label>, <Input> and <InputError>. */

import { If, For } from '../ui/flow';
import { effect, getScope } from '../reactive/reactive';
import type { Child } from '../ui/dom';
import type { ElementProps } from '../ui/jsx';
import { APP } from '../ui/component';
import type { Application } from '../application/application';
import { HiddenField } from './controls';
import type { FormControl } from './controls';
import type { Form } from './form';

/** The <form> element, like {form} in Latte. Sending it validates the form and calls onSuccess. */
export function FormTag(props: { form: Form<any>; children?: Child } & Omit<ElementProps<HTMLFormElement>, 'children' | 'ref'>): Child {
  const { form, children, ...attributes } = props;
  const app = getScope()?.find<Application>(APP);
  return (
    <form
      {...attributes}
      id={form.id}
      noValidate
      ref={element => {
        form.element = element;
        // Elements switched by toggle() are usually inside the form, so they are found before it is in the page
        effect(() => {
          for (const [id, show] of form.toggles()) {
            const target = element.querySelector(`[id="${id.replace(/"/g, '\\"')}"]`) ?? document.getElementById(id);
            target?.toggleAttribute('hidden', !show);
          }
        });
      }}
      onSubmit={event => {
        event.preventDefault();
        const button = form.clickedButton;
        form.clickedButton = null;
        form.submit(button).catch(error => (app ? app.onError(error) : console.error(error)));
      }}
    >
      {children}
    </form>
  );
}

/** Like {label name} in Latte. A required control has the class `required`. */
export function Label(props: { control: FormControl<any>; children?: Child }): Child {
  const { control } = props;
  return (
    <label for={control.htmlId} class={control.isRequired() ? 'required' : null}>
      {props.children ?? control.label}
    </label>
  );
}

/** Like {input name} in Latte. Other attributes go to the element: <Input control={...} class="wide" />. */
export function Input(props: { control: FormControl<any> } & Record<string, unknown>): Child {
  const { control, ...attributes } = props;
  return control.render(attributes);
}

/** Like {inputError name} in Latte: the error of the control, shown only while there is one. */
export function InputError(props: { control: FormControl<any> }): Child {
  const { control } = props;
  return (
    <If when={() => control.errors().length}>
      <span class="phlox-form-error" id={`${control.htmlId}-error`}>{() => control.errors()[0]}</span>
    </If>
  );
}

/** Errors of the whole form, e.g. from the server. */
export function FormErrors(props: { form: Form<any> }): Child {
  return (
    <If when={() => props.form.errors().length}>
      <ul class="phlox-form-errors" role="alert">
        <For each={props.form.errors}>{error => <li>{error}</li>}</For>
      </ul>
    </If>
  );
}

/**
 * The whole form, like {control form} in Latte. Every control gets a row with the id `<control id>-pair`,
 * which toggle() can use.
 */
export function FormView(props: { form: Form<any> } & Omit<ElementProps<HTMLFormElement>, 'children' | 'ref'>): Child {
  const { form, ...attributes } = props;
  const controls = [...form.controls.values()];
  return (
    <FormTag form={form} class="phlox-form" {...attributes}>
      <FormErrors form={form} />
      {controls.filter(control => !(control instanceof HiddenField)).map(control => (
        <div class="phlox-form-row" id={`${control.htmlId}-pair`}>
          {control.labelInInput ? null : <Label control={control} />}
          <Input control={control} />
          <InputError control={control} />
        </div>
      ))}
      {controls.filter(control => control instanceof HiddenField).map(control => <Input control={control} />)}
      <div class="phlox-form-buttons">
        {[...form.buttons.values()].map(button => <Input control={button} />)}
      </div>
    </FormTag>
  );
}
