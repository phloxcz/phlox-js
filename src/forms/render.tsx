/** Rendering of forms: automatic <FormView>, or by hand with <FormTag>, <Label>, <Input> and <InputError>. */

import { If, For } from '../ui/flow';
import { effect, getScope, untrack } from '../reactive/reactive';
import type { Child } from '../ui/dom';
import type { ElementProps } from '../ui/jsx';
import { APP } from '../ui/component';
import { classes, currentTheme } from '../ui/theme';
import { dragToSort } from '../ui/sortable';
import type { Application } from '../application/application';
import { FormControl, HiddenField } from './controls';
import type { Container } from './container';
import { Multiplier } from './multiplier';
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
        form.markRendered();
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
      // The browser sends a form by Enter only when it has a submit button or a single text field.
      // A form whose Save is in the footer of a dialog has neither, so Enter is handled here.
      // A control that uses Enter itself (a pick in a list) prevents it and is left alone.
      onKeydown={event => {
        const target = event.target;
        if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing) return;
        if (!(target instanceof HTMLInputElement) || /^(button|submit|reset|checkbox|radio|file|image)$/.test(target.type)) return;
        if (event.currentTarget.querySelector('[type=submit], input[type=image]')) return;
        event.preventDefault();
        form.submit().catch(error => (app ? app.onError(error) : console.error(error)));
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
    <label for={control.htmlId} class={classes(currentTheme().class('label'), control.isRequired() && 'required') || null}>
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
      <span class={currentTheme().class('error')} id={`${control.htmlId}-error`}>{() => control.errors()[0]}</span>
    </If>
  );
}

/** Errors of the whole form, e.g. from the server. */
export function FormErrors(props: { form: Form<any> }): Child {
  return (
    <If when={() => props.form.errors().length}>
      <ul class={currentTheme().class('formErrors')} role="alert">
        <For each={props.form.errors}>{error => <li>{error}</li>}</For>
      </ul>
    </If>
  );
}

/**
 * The whole form, like {control form} in Latte. Every control gets a row with the id `<control id>-pair`,
 * which toggle() can use. Containers become groups, multipliers rows that can be added and ordered.
 */
export function FormView(props: { form: Form<any> } & Omit<ElementProps<HTMLFormElement>, 'children' | 'ref'>): Child {
  const { form, ...attributes } = props;
  const theme = currentTheme();
  return (
    <FormTag form={form} class={theme.class('form') || null} {...attributes}>
      <FormErrors form={form} />
      {renderMembers(form)}
      <div class={theme.class('formButtons')}>
        {[...form.buttons.values()].map(button => <Input control={button} />)}
      </div>
    </FormTag>
  );
}

/** A label, the control and its error, like a row of {control form}. */
function ControlRow(props: { control: FormControl<any>; slot: string }): Child {
  const { control } = props;
  return (
    <div class={currentTheme().class(props.slot)} id={`${control.htmlId}-pair`}>
      {control.labelInInput ? null : <Label control={control} />}
      <Input control={control} />
      <InputError control={control} />
    </div>
  );
}

/** Members of a container: controls as rows, containers as groups, multipliers as rows to add and order. */
function renderMembers(container: Container<any>, slot = 'formRow'): Child {
  const theme = currentTheme();
  return [...container.members.values()].map(member => {
    if (member instanceof HiddenField) return <Input control={member} />;
    if (member instanceof FormControl) return <ControlRow control={member} slot={slot} />;
    if (member instanceof Multiplier) return <MultiplierView multiplier={member} />;
    return (
      <fieldset class={theme.class('group')} id={`${member.idPrefix}-pair`}>
        {member.label ? <legend class={theme.class('legend')}>{member.label}</legend> : null}
        {renderMembers(member)}
      </fieldset>
    );
  });
}

/** Errors of the rows as a whole, e.g. too few of them. */
export function MultiplierErrors(props: { multiplier: Multiplier<any> }): Child {
  const { multiplier } = props;
  return (
    <If when={() => multiplier.errors().length}>
      <div class={currentTheme().class('error')} role="alert" id={`${multiplier.idPrefix}-error`}>
        {() => multiplier.errors()[0]}
      </div>
    </If>
  );
}

/**
 * Rows of a multiplier with buttons to add, remove and move them, and a handle to drag them.
 * Without children every row shows its controls with labels. With children the row is drawn by them:
 * <MultiplierView multiplier={lines}>{row => <Input control={row.get('name')} />}</MultiplierView>.
 */
export function MultiplierView<R extends object>(props: {
  multiplier: Multiplier<R>;
  children?: (row: Container<R>, index: () => number) => Child;
}): Child {
  const { multiplier } = props;
  const theme = currentTheme();
  const texts = Multiplier.texts;
  let list: HTMLElement;
  const elements = () => [...list.children].filter((child): child is HTMLElement => child instanceof HTMLElement);

  return (
    <fieldset class={theme.class('multiplier')} id={`${multiplier.idPrefix}-pair`}>
      {multiplier.label ? <legend class={theme.class('legend')}>{multiplier.label}</legend> : null}
      <MultiplierErrors multiplier={multiplier} />
      <div role="list" ref={element => { list = element; }}>
        <For each={multiplier.rows}>
          {(row, index) => {
            let element: HTMLElement;
            let handle: HTMLElement;
            const moveBy = (step: number) => {
              multiplier.move(row, untrack(index) + step);
              // A moved element may lose the focus, the user goes on from the same handle
              queueMicrotask(() => handle.focus());
            };
            return (
              <div class={theme.class('multiplierRow')} role="listitem" data-phlox-row ref={el => { element = el; }}>
                <button
                  type="button"
                  class={theme.class('multiplierHandle')}
                  aria-label={() => `${texts.drag} (${index() + 1})`}
                  title={texts.drag}
                  ref={el => { handle = el; }}
                  onPointerdown={event => dragToSort(event, element, { items: elements, move: to => multiplier.move(row, to) })}
                  onKeydown={event => {
                    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                    event.preventDefault();
                    moveBy(event.key === 'ArrowUp' ? -1 : 1);
                  }}
                >
                  ⠿
                </button>
                <div class={theme.class('multiplierFields')}>
                  {props.children ? props.children(row, index) : renderMembers(row, 'multiplierField')}
                </div>
                <div class={theme.class('multiplierButtons')}>
                  <button type="button" class={theme.class('multiplierButton')} aria-label={texts.moveUp} title={texts.moveUp}
                    disabled={() => index() === 0} onClick={() => moveBy(-1)}>↑</button>
                  <button type="button" class={theme.class('multiplierButton')} aria-label={texts.moveDown} title={texts.moveDown}
                    disabled={() => index() === multiplier.rows().length - 1} onClick={() => moveBy(1)}>↓</button>
                  <button type="button" class={theme.class('multiplierButton')} aria-label={texts.remove} title={texts.remove}
                    disabled={() => !multiplier.canRemove()} onClick={() => multiplier.remove(row)}>×</button>
                </div>
              </div>
            );
          }}
        </For>
      </div>
      <button
        type="button"
        class={theme.class('multiplierAdd')}
        disabled={() => !multiplier.canAdd()}
        onClick={() => {
          const row = multiplier.add();
          // The first field of the new row gets the focus, the user goes on typing
          if (row) queueMicrotask(() => row.controls[0]?.element?.focus());
        }}
      >
        + {texts.add}
      </button>
    </fieldset>
  );
}
