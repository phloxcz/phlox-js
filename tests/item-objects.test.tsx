import { afterEach, describe, expect, test } from 'vitest';
import { render } from '../src/index';
import type { Child } from '../src/index';
import { Form, FormView } from '../src/forms/index';
import { tick } from './helpers';

interface Person {
  id: number;
  name: string;
  color: string;
}

interface Task {
  assignee: number | null;
  reviewer: number | null;
  watchers: number[];
}

const people: Person[] = [
  { id: 1, name: 'Jan Novák', color: 'blue' },
  { id: 2, name: 'Lucie Dvořáková', color: 'teal' },
  { id: 3, name: 'Petra Svobodová', color: 'orange' },
];

const person = (item: Person) => <span class="person" data-color={item.color}><b>{item.name.slice(0, 1)}</b> {item.name}</span>;

function mount(view: () => Child) {
  const root = document.createElement('div');
  document.body.append(root);
  render(view, root);
  return root;
}

const type = (input: HTMLInputElement, text: string) => {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));

afterEach(() => document.body.replaceChildren());

describe('items as objects with a template', () => {
  test('DropDownList: the template in the list and in the button, the value from itemValue, search by itemLabel', async () => {
    const form = new Form<Task>();
    const assignee = form.addDropDownList('assignee', 'Řešitel', {
      items: people, itemValue: item => item.id, itemLabel: item => item.name, template: person, placeholder: 'Nikdo',
    });
    const root = mount(() => <FormView form={form} />);
    const trigger = root.querySelector<HTMLButtonElement>('button[role=combobox]')!;
    expect(trigger.textContent).toBe('Nikdo');

    trigger.click();
    await tick();
    const rows = () => [...root.querySelectorAll<HTMLElement>('[role=option][data-value]')];
    expect(rows().map(row => row.querySelector('.person')?.getAttribute('data-color'))).toEqual(['blue', 'teal', 'orange']);
    type(root.querySelector<HTMLInputElement>('.dropdownlist-filter-input')!, 'dvor');
    await tick();
    expect(rows().map(row => row.dataset.value)).toEqual(['2']);
    rows()[0]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(assignee.getValue()).toBe(2);
    expect(trigger.querySelector('.person')!.getAttribute('data-color')).toBe('teal');

    // From code: the item is known, or given with the value
    assignee.setValue(3);
    expect(trigger.querySelector('.person')!.textContent).toBe('P Petra Svobodová');
    assignee.setValue(9, { id: 9, name: 'Eva Malá', color: 'red' });
    expect(trigger.querySelector('.person')!.getAttribute('data-color')).toBe('red');
    expect(assignee.selectedLabel()).toBe('Eva Malá');
  });

  test('DropDownList: objects from search, and the label option may return the item', async () => {
    const form = new Form<Task>();
    const reviewer = form.addDropDownList('reviewer', 'Kontrola', {
      search: text => people.filter(item => item.name.includes(text)),
      label: id => ({ id, name: `Uživatel ${id}`, color: 'gray' }),
      itemValue: item => item.id,
      itemLabel: item => item.name,
      template: person,
    });
    const root = mount(() => <FormView form={form} />);
    form.setDefaults({ reviewer: 7 });
    await tick();
    const trigger = root.querySelector<HTMLButtonElement>('button[role=combobox]')!;
    expect(trigger.querySelector('.person')!.getAttribute('data-color')).toBe('gray');
    trigger.click();
    await tick();
    expect(root.querySelectorAll('[role=option] .person').length).toBe(4);
    expect(reviewer.getValue()).toBe(7);
  });

  test('ComboBox: the template in the list, the text of the item in the field', async () => {
    const form = new Form<Task>();
    const assignee = form.addComboBox('assignee', 'Řešitel', { items: people, itemValue: item => item.id, itemLabel: item => item.name, template: person });
    const root = mount(() => <FormView form={form} />);
    const input = root.querySelector<HTMLInputElement>('input[role=combobox]')!;
    input.dispatchEvent(new FocusEvent('focus'));
    type(input, 'Jan');
    await tick();
    const row = root.querySelector<HTMLElement>('[role=option][data-value]')!;
    expect(row.querySelector('.person')!.getAttribute('data-color')).toBe('blue');
    key(input, 'ArrowDown');
    key(input, 'Enter');
    expect(assignee.getValue()).toBe(1);
    expect(input.value).toBe('Jan Novák');
  });

  test('TagInput: the template in suggestions and tags', async () => {
    const form = new Form<Task>();
    const watchers = form.addTagInput('watchers', 'Sledují', { items: people, itemValue: item => item.id, itemLabel: item => item.name, template: person });
    const root = mount(() => <FormView form={form} />);
    const input = root.querySelector<HTMLInputElement>('input[role=combobox]')!;
    type(input, 'pet');
    await tick();
    expect(root.querySelector('[role=option] .person')!.getAttribute('data-color')).toBe('orange');
    key(input, 'Enter');
    watchers.setValue([3, 1]);
    expect(watchers.getValue()).toEqual([3, 1]);
    expect([...root.querySelectorAll('[data-phlox-taginput-tag] .person')].map(tag => tag.getAttribute('data-color'))).toEqual(['orange', 'blue']);
  });

  test('types: objects need itemValue of the type of the field', () => {
    const form = new Form<Task>();
    // @ts-expect-error objects without itemValue
    void (() => form.addDropDownList('assignee', '', { items: people }));
    // @ts-expect-error itemValue must give the type of the field
    void (() => form.addDropDownList('assignee', '', { items: people, itemValue: item => item.name }));
    // @ts-expect-error pairs must still have the type of the field
    void (() => form.addDropDownList('assignee', '', { items: [['x', 'X']] }));
    // The item in itemLabel and template has the type of the items
    void (() => form.addTagInput('watchers', '', { items: people, itemValue: item => item.id, template: item => item.color }));
  });
});
