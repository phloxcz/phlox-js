import { afterEach, describe, expect, test, vi } from 'vitest';
import { Presenter, render } from '../src/index';
import type { Child } from '../src/index';
import { Form, FormTag, FormView, Input, InputError, Label } from '../src/forms/index';
import { RpcError } from '../src/net/index';
import { boot, tick } from './helpers';

/** The shape of a DTO generated from PHP. */
interface CreateTask {
  name: string;
  note: string | null;
  email: string;
  priority: number;
  estimate: number | null;
  dueDate: string | null;
  done: boolean;
  labels: string[];
  status: 'open' | 'closed';
}

function mount(view: () => Child): HTMLElement {
  const root = document.createElement('div');
  document.body.append(root);
  render(view, root);
  return root;
}

const type = (input: Element, value: string) => {
  (input as HTMLInputElement).value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

afterEach(() => document.body.replaceChildren());

describe('rules', () => {
  test('required and the first failing rule of a control', () => {
    const form = new Form<CreateTask>();
    const name = form.addText('name', 'Název:').setRequired('Vyplňte název.').addRule(Form.MinLength, 'Aspoň %d znaky.', 3);
    expect(form.validate()).toBe(false);
    expect(name.errors()).toEqual(['Vyplňte název.']);
    name.setValue('ab');
    form.validate();
    expect(name.errors()).toEqual(['Aspoň 3 znaky.']);
    name.setValue('abc');
    expect(form.validate()).toBe(true);
    expect(name.errors()).toEqual([]);
  });

  test('other rules apply only to a filled control, as in Nette', () => {
    const form = new Form<CreateTask>();
    const email = form.addEmail('email', 'E-mail:');
    expect(form.validate()).toBe(true);
    email.setValue('nope');
    expect(form.validate()).toBe(false);
    expect(email.errors()).toEqual(['Please enter a valid email address.']);
  });

  test('validators', () => {
    const form = new Form<Record<string, any>>();
    const value = form.addText('value');
    const check = (validator: Parameters<typeof value.addRule>[0], input: string, arg?: unknown) => {
      const probe = new Form<Record<string, any>>();
      const control = probe.addText('x').addRule(validator, 'bad', arg);
      control.setValue(input);
      return probe.validate();
    };
    expect(check(Form.Email, 'ann@example.com')).toBe(true);
    expect(check(Form.Email, 'ann@example')).toBe(false);
    expect(check(Form.URL, 'nette.org')).toBe(true);
    expect(check(Form.URL, 'https://nette.org/cs')).toBe(true);
    expect(check(Form.URL, 'not a url')).toBe(false);
    expect(check(Form.Pattern, 'AB12', '[A-Z]{2}\\d+')).toBe(true);
    expect(check(Form.Pattern, 'xAB12', '[A-Z]{2}\\d+')).toBe(false);
    expect(check(Form.Integer, '-15')).toBe(true);
    expect(check(Form.Integer, '1.5')).toBe(false);
    expect(check(Form.Float, '1,5')).toBe(true);
    expect(check(Form.MaxLength, 'abcd', 3)).toBe(false);
    expect(check(Form.Length, 'abc', [2, 4])).toBe(true);
    expect(check(Form.Length, 'abcde', [2, 4])).toBe(false);
    expect(check(Form.Equal, 'yes', ['yes', 'ok'])).toBe(true);
    expect(check(Form.NotEqual, 'yes', 'yes')).toBe(false);
    expect(check(Form.Min, '2026-11-11', '2026-11-10')).toBe(true);
    expect(check(Form.Max, '2026-11-11', '2026-11-10')).toBe(false);
    void value;
  });

  test('number fields: value is a number, an invalid text fails Integer', () => {
    const form = new Form<CreateTask>();
    const estimate = form.addInteger('estimate', 'Odhad:').addRule(Form.Range, 'Mezi %d a %d.', [1, 10]);
    estimate.raw.set('12');
    expect(estimate.getValue()).toBe(12);
    form.validate();
    expect(estimate.errors()).toEqual(['Mezi 1 a 10.']);
    estimate.raw.set('x1');
    expect(estimate.getValue()).toBeNull();
    form.validate();
    expect(estimate.errors()).toEqual(['Please enter a valid integer.']);
    estimate.raw.set('');
    expect(estimate.getValue()).toBeNull();
    expect(form.validate()).toBe(true);
  });

  test('Equal compares with another control', () => {
    const form = new Form<{ password: string; again: string }>();
    const password = form.addPassword('password');
    const again = form.addPassword('again').addRule(Form.Equal, 'Hesla se neshodují.', password);
    password.setValue('secret');
    again.setValue('secret!');
    form.validate();
    expect(again.errors()).toEqual(['Hesla se neshodují.']);
    again.setValue('secret');
    expect(form.validate()).toBe(true);
  });

  test('placeholders in messages', () => {
    const form = new Form<CreateTask>();
    const name = form.addText('name', 'Název:').addRule(Form.MaxLength, '%label: nejvýš %d znaků, máte „%value“.', 2);
    name.setValue('abc');
    form.validate();
    expect(name.errors()).toEqual(['Název: nejvýš 2 znaků, máte „abc“.']);
  });

  test('conditions, else, endCondition and conditions on another control', () => {
    const form = new Form<CreateTask>();
    const done = form.addCheckbox('done', 'Hotovo');
    const note = form.addText('note', 'Poznámka:');
    note
      .addConditionOn(done, Form.Filled)
        .setRequired('Vyplňte poznámku k hotovému úkolu.')
      .elseCondition()
        .addRule(Form.MaxLength, 'Rozpracovaný úkol má poznámku nejvýš %d znaků.', 3)
      .endCondition()
      .addRule(Form.Pattern, 'Jen písmena.', '[a-z]*');

    note.setValue('abcd');
    form.validate();
    expect(note.errors()).toEqual(['Rozpracovaný úkol má poznámku nejvýš 3 znaků.']);

    done.setValue(true);
    note.setValue('');
    form.validate();
    expect(note.errors()).toEqual(['Vyplňte poznámku k hotovému úkolu.']);

    note.setValue('abc1');
    form.validate();
    expect(note.errors()).toEqual(['Jen písmena.']);
  });

  test('a disabled control is neither validated nor among the values', () => {
    const form = new Form<CreateTask>();
    form.addText('name').setRequired().setDisabled();
    expect(form.validate()).toBe(true);
    expect('name' in form.getValues()).toBe(false);
  });

  test('default messages can be replaced for the language of the application', () => {
    const original = Form.messages.get(Form.Filled);
    Form.messages.set(Form.Filled, 'Pole %label je povinné.');
    const form = new Form<CreateTask>();
    const name = form.addText('name', 'Název:').setRequired();
    form.validate();
    expect(name.errors()).toEqual(['Pole Název je povinné.']);
    Form.messages.set(Form.Filled, original!);
  });
});

describe('values', () => {
  test('getValues and setDefaults with the types of the DTO', () => {
    const form = new Form<CreateTask>();
    form.addText('name');
    form.addText('note').setNullable();
    form.addSelect('priority', 'Priorita:', { 1: 'Nízká', 2: 'Střední', 3: 'Vysoká' });
    form.addInteger('estimate');
    form.addDate('dueDate');
    form.addCheckbox('done');
    form.addCheckboxList('labels', 'Štítky:', [['bug', 'Chyba'], ['ui', 'Vzhled']]);
    form.addRadioList('status', 'Stav:', [['open', 'Otevřený'], ['closed', 'Uzavřený']]);
    form.addSubmit('save', 'Uložit');

    expect(form.getValues()).toEqual({
      name: '', note: null, priority: null, estimate: null, dueDate: null, done: false, labels: [], status: null,
    });

    form.setDefaults({ name: 'Úkol', priority: 2, estimate: 5, dueDate: '2026-12-01', done: true, labels: ['ui'], status: 'open' });
    expect(form.getValues()).toEqual({
      name: 'Úkol', note: null, priority: 2, estimate: 5, dueDate: '2026-12-01', done: true, labels: ['ui'], status: 'open',
    });

    form.reset();
    expect(form.getValues().name).toBe('');
    expect(form.getValues().labels).toEqual([]);
  });

  test('names and types of controls are checked against the DTO', () => {
    const form = new Form<CreateTask>();
    // @ts-expect-error no such field in the DTO
    void (() => form.addText('nmae'));
    // @ts-expect-error priority is a number, not a text
    void (() => form.addText('priority'));
    // @ts-expect-error done is a boolean
    void (() => form.addInteger('done'));
    // @ts-expect-error labels is not a boolean
    void (() => form.addCheckbox('labels'));
    // @ts-expect-error items of a select have the type of the field
    void (() => form.addRadioList('status', '', [['archived', 'Archiv']]));
    // @ts-expect-error a multiselect needs a list
    void (() => form.addMultiSelect('name'));
    const values: CreateTask = form.getValues();
    void values;
  });

  test('a control name can be used only once', () => {
    const form = new Form<CreateTask>();
    form.addText('name');
    expect(() => form.addText('name')).toThrow("already has a control 'name'");
    expect(() => form.get('email')).toThrow("has no control 'email'");
  });
});

describe('submit', () => {
  test('a valid form calls onSuccess with the values, submit buttons are disabled meanwhile', async () => {
    const form = new Form<CreateTask>();
    form.addText('name').setRequired();
    const save = form.addSubmit('save', 'Uložit');
    let finish!: () => void;
    const received: unknown[] = [];
    form.onSuccess = values => {
      received.push(values);
      return new Promise(resolve => { finish = resolve; });
    };
    const root = mount(() => <FormView form={form} />);
    const button = root.querySelector('button')!;

    type(root.querySelector('input')!, 'Úkol');
    button.click();
    await tick();
    expect(received).toEqual([{ name: 'Úkol' }]);
    expect(button.disabled).toBe(true);
    expect(save.isSubmittedBy()).toBe(true);
    finish();
    await tick();
    expect(button.disabled).toBe(false);
  });

  test('an invalid form calls onError, shows errors and focuses the first invalid control', async () => {
    const form = new Form<CreateTask>();
    form.addText('email');
    form.addText('name', 'Název:').setRequired('Vyplňte název.');
    form.addSubmit('save');
    const success = vi.fn();
    const error = vi.fn();
    form.onSuccess = success;
    form.onError = error;
    const root = mount(() => <FormView form={form} />);

    root.querySelector('button')!.click();
    await tick();
    expect(success).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    const name = root.querySelector<HTMLInputElement>('#' + form.get('name').htmlId)!;
    expect(document.activeElement).toBe(name);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('.phlox-form-error')!.textContent).toBe('Vyplňte název.');
    expect(name.getAttribute('aria-describedby')).toBe(root.querySelector('.phlox-form-error')!.id);
  });

  test('a button with an empty validation scope sends the form without validation', async () => {
    const form = new Form<CreateTask>();
    form.addText('name').setRequired();
    form.addSubmit('save');
    const cancel = form.addSubmit('cancel').setValidationScope([]);
    const pressed: string[] = [];
    form.onSuccess = () => { pressed.push(cancel.isSubmittedBy() ? 'cancel' : 'save'); };
    const root = mount(() => <FormView form={form} />);
    root.querySelector<HTMLButtonElement>(`#${cancel.htmlId}`)!.click();
    await tick();
    expect(pressed).toEqual(['cancel']);
  });

  test('invalid parameters from the server are shown at the controls', async () => {
    const form = new Form<CreateTask>();
    form.addText('name', 'Název:');
    form.addText('email', 'E-mail:');
    form.addSubmit('save');
    form.onSuccess = async () => {
      throw new RpcError(-32602, 'Invalid method parameter(s).', {
        fields: { 'input.name': 'must have at least 2 characters.', 'input.addresses.1.city': 'is required.' },
      }, 'task.create');
    };
    const root = mount(() => <FormView form={form} />);

    expect(await form.submit()).toBe(false);
    expect(form.get('name').errors()).toEqual(['must have at least 2 characters.']);
    expect(form.errors()).toEqual(['input.addresses.1.city: is required.']);
    expect(root.querySelector('.phlox-form-errors')!.textContent).toContain('is required.');

    // A new submit starts clean
    form.onSuccess = () => {};
    expect(await form.submit()).toBe(true);
    expect(form.hasErrors()).toBe(false);
  });

  test('another error of onSuccess goes to app.onError', async () => {
    const form = new Form<CreateTask>();
    form.addText('name');
    form.addSubmit('save');
    form.onSuccess = async () => { throw new Error('server down'); };
    class Page extends Presenter {
      render() { return <FormView form={form} />; }
    }
    const { element, errors } = await boot(Page);
    element.querySelector('button')!.click();
    await tick();
    expect(String(errors[0])).toContain('server down');
  });

  test('a form can be sent from code, e.g. from a button in the footer of a dialog', async () => {
    const form = new Form<CreateTask>();
    form.addText('name').setRequired();
    const success = vi.fn();
    form.onSuccess = success;
    expect(await form.submit()).toBe(false);
    form.get('name').setValue('x');
    expect(await form.submit()).toBe(true);
    expect(success).toHaveBeenCalledWith({ name: 'x' }, form);
  });
});

describe('rendering', () => {
  test('by hand, like {form}, {label}, {input} and {inputError} in Latte', () => {
    const form = new Form<CreateTask>();
    form.addText('name', 'Název:').setRequired('Vyplňte.');
    form.addSubmit('save', 'Uložit');
    const root = mount(() => (
      <FormTag form={form} class="task">
        <div class="field">
          <Label control={form.get('name')} />
          <Input control={form.get('name')} class="wide" placeholder="např. Nákup" />
          <InputError control={form.get('name')} />
        </div>
        <Input control={form.getButton('save')} class="btn" />
      </FormTag>
    ));
    const element = root.querySelector('form')!;
    const label = root.querySelector('label')!;
    const input = root.querySelector('input')!;
    expect(element.className).toBe('task');
    expect(element.noValidate).toBe(true);
    expect(label.htmlFor).toBe(input.id);
    expect(label.classList.contains('required')).toBe(true);
    expect(label.textContent).toBe('Název:');
    expect([...input.classList]).toEqual(['phlox-input', 'wide']);
    expect(input.placeholder).toBe('např. Nákup');
    expect(input.name).toBe('name');
    expect(input.required).toBe(true);
    expect(root.querySelector('button')!.className).toBe('btn');
    expect(root.querySelector('.phlox-form-error')).toBeNull();
  });

  test('attrs() puts the control on an own element, like n:name', () => {
    const form = new Form<CreateTask>();
    const name = form.addText('name');
    const root = mount(() => <FormTag form={form}><input class="own" {...name.attrs()} /></FormTag>);
    type(root.querySelector('input')!, 'typed');
    expect(name.getValue()).toBe('typed');
    name.setValue('from code');
    expect(root.querySelector('input')!.value).toBe('from code');
  });

  test('live validation: after leaving the field, and while fixing an error', () => {
    const form = new Form<CreateTask>();
    const name = form.addText('name').setRequired('Vyplňte.').addRule(Form.MinLength, 'Aspoň %d.', 3);
    const root = mount(() => <FormView form={form} />);
    const input = root.querySelector('input')!;

    type(input, 'a');
    expect(name.errors()).toEqual([]);
    input.dispatchEvent(new Event('blur'));
    expect(name.errors()).toEqual(['Aspoň 3.']);
    type(input, 'abc');
    expect(name.errors()).toEqual([]);
  });

  test('every kind of control renders and writes its value', () => {
    const form = new Form<CreateTask>();
    form.addTextArea('note');
    form.addSelect('priority', '', { 1: 'Nízká', 2: 'Vysoká' }).setPrompt('Vyberte');
    form.addCheckbox('done', 'Hotovo');
    form.addCheckboxList('labels', '', [['bug', 'Chyba'], ['ui', 'Vzhled']]);
    form.addRadioList('status', '', [['open', 'Otevřený'], ['closed', 'Uzavřený']]);
    form.addHidden('email', 'hidden@example.com');
    form.setDefaults({ priority: 2 });
    const root = mount(() => <FormView form={form} />);

    const select = root.querySelector('select')!;
    expect(select.value).toBe('1');
    expect(select.options[0]!.textContent).toBe('Vyberte');
    select.value = '0';
    select.dispatchEvent(new Event('change'));

    type(root.querySelector('textarea')!, 'text');
    const checkboxes = root.querySelectorAll<HTMLInputElement>('input[type=checkbox]');
    checkboxes[0]!.click();
    checkboxes[2]!.click();
    root.querySelectorAll<HTMLInputElement>('input[type=radio]')[1]!.click();
    expect(root.querySelector('.phlox-checkbox')!.textContent).toContain('Hotovo');

    expect(form.getValues()).toEqual({
      note: 'text', priority: 1, done: true, labels: ['ui'], status: 'closed', email: 'hidden@example.com',
    });
  });

  test('items can come later, e.g. from the server', () => {
    const form = new Form<CreateTask>();
    const priority = form.addSelect('priority', '').setPrompt('-');
    form.setDefaults({ priority: 3 });
    const root = mount(() => <FormView form={form} />);
    priority.setItems([[1, 'Nízká'], [3, 'Vysoká']]);
    expect(root.querySelector('select')!.selectedOptions[0]!.textContent).toBe('Vysoká');
  });

  test('toggle() shows an element while the condition holds', () => {
    const form = new Form<CreateTask>();
    const done = form.addCheckbox('done', 'Hotovo');
    form.addText('note', 'Poznámka:');
    done.addCondition(Form.Filled).toggle(`${form.get('note').htmlId}-pair`);
    const root = mount(() => <FormView form={form} />);
    const pair = root.querySelector<HTMLElement>(`#${form.get('note').htmlId}-pair`)!;
    expect(pair.hidden).toBe(true);
    root.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    expect(pair.hidden).toBe(false);
  });
});
