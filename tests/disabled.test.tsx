/**
 * Disabled and read-only controls, disabled items: setDisabled(), setReadOnly(), setDisabled([values]) of choices
 * and the option itemDisabled of DropDownList, ComboBox and TagInput.
 */
import { afterEach, describe, expect, test } from 'vitest';
import { render } from '../src/index';
import type { Child } from '../src/index';
import { Form, FormView } from '../src/forms/index';
import type { TreeNode } from '../src/components/index';
import { tick } from './helpers';

function mount(view: () => Child) {
  const root = document.createElement('div');
  document.body.append(root);
  render(view, root);
  return root;
}

const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
const mousedown = (target: Element) => target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
const type = (input: HTMLInputElement, text: string) => {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

afterEach(() => document.body.replaceChildren());

describe('read-only controls', () => {
  test('a text field is readonly, stays in the values and is checked; a disabled one is left out', () => {
    const form = new Form<{ code: string; note: string }>();
    const code = form.addText('code', 'Kód').setRequired('Vyplňte kód.').setReadOnly();
    form.addText('note', 'Poznámka').setDisabled();
    form.setDefaults({ code: '', note: 'x' });
    const root = mount(() => <FormView form={form} />);
    const input = root.querySelector<HTMLInputElement>(`#${code.htmlId}`)!;
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
    expect(input.getAttribute('aria-readonly')).toBe('true');
    expect(form.getValues()).toEqual({ code: '' });
    expect(form.validate()).toBe(false);
    code.setReadOnly(false);
    expect(input.readOnly).toBe(false);
  });

  test('checkbox, radio list and checkbox list keep their state when clicked', () => {
    const form = new Form<{ agree: boolean; color: string | null; days: string[] }>();
    const agree = form.addCheckbox('agree', 'Souhlas').setReadOnly();
    const color = form.addRadioList('color', 'Barva', ['red', 'blue']).setReadOnly();
    const days = form.addCheckboxList('days', 'Dny', ['po', 'út']).setReadOnly();
    const root = mount(() => <FormView form={form} />);
    root.querySelector<HTMLInputElement>(`#${agree.htmlId}`)!.click();
    root.querySelector<HTMLInputElement>(`#${color.htmlId}-1`)!.click();
    root.querySelector<HTMLInputElement>(`#${days.htmlId}-0`)!.click();
    expect(form.getValues()).toEqual({ agree: false, color: null, days: [] });
    expect(root.querySelector<HTMLInputElement>(`#${agree.htmlId}`)!.checked).toBe(false);
    expect(root.querySelector<HTMLInputElement>(`#${color.htmlId}-1`)!.disabled).toBe(false);
  });

  test('a select does not open nor change by the keyboard, Tab moves on', () => {
    const form = new Form<{ size: string | null }>();
    const size = form.addSelect('size', 'Velikost', ['S', 'M']).setReadOnly();
    const root = mount(() => <FormView form={form} />);
    const select = root.querySelector<HTMLSelectElement>(`#${size.htmlId}`)!;
    expect(mousedown(select)).toBe(false);
    expect(key(select, 'ArrowDown')).toBe(false);
    expect(key(select, 'Tab')).toBe(true);
  });

  test('DropDownList, ComboBox and the drop-down tree do not open; TagInput has no crosses and Backspace keeps the tag', async () => {
    const form = new Form<{ city: number | null; shop: string | null; tags: string[]; parent: number | null }>();
    form.addDropDownList('city', 'Město', { items: [[1, 'Praha'], [2, 'Brno']] }).setReadOnly();
    const shop = form.addComboBox('shop', 'Obchod', { items: ['Albert', 'Billa'] }).setReadOnly();
    const tags = form.addTagInput('tags', 'Štítky', { items: ['a', 'b'] }).setReadOnly();
    form.addDropDownTreeSelect('parent', 'Nadřazená', { nodes: [{ id: 1, label: 'Ovoce' }] }).setReadOnly();
    tags.setValue(['a']);
    form.get('parent').setValue(1);
    const root = mount(() => <FormView form={form} />);

    const [dropdown, tree] = root.querySelectorAll<HTMLButtonElement>('button[role=combobox]');
    dropdown!.click();
    tree!.click();
    await tick();
    expect(root.querySelector('[data-dropdownlist-panel]')).toBeNull();
    expect(root.querySelector('.phlox-dropdowntree-clear')).toBeNull();
    key(tree!, 'Delete');
    expect(form.get('parent').getValue()).toBe(1);

    const combo = root.querySelector<HTMLInputElement>(`#${shop.htmlId}`)!;
    expect(combo.readOnly).toBe(true);
    combo.focus();
    await tick();
    expect(root.querySelector('.combobox-dropdown [role=option]')).toBeNull();

    const tagInput = root.querySelector<HTMLInputElement>(`#${tags.htmlId}`)!;
    expect(tagInput.readOnly).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-phlox-taginput-remove]')!.hidden).toBe(true);
    key(tagInput, 'Backspace');
    expect(tags.getValue()).toEqual(['a']);
  });

  test('upload: no browsing, dropping nor removing', () => {
    const form = new Form<{ files: File[] }>();
    const files = form.addMultiUpload('files', 'Soubory').setReadOnly();
    files.setValue([new File(['x'], 'a.txt')]);
    const root = mount(() => <FormView form={form} />);
    expect(root.querySelector<HTMLButtonElement>('.pu-browse-btn')!.hidden).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('.pu-row-remove')!.hidden).toBe(true);
    const zone = root.querySelector<HTMLElement>('.pu-dropzone')!;
    expect(zone.getAttribute('aria-readonly')).toBe('true');
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.assign(drop, { dataTransfer: { files: [new File(['y'], 'b.txt')] } });
    zone.dispatchEvent(drop);
    expect(files.getValue().map(file => file.name)).toEqual(['a.txt']);
  });
});

describe('tree in a form', () => {
  const NODES: TreeNode<number>[] = [{ id: 1, label: 'Ovoce' }, { id: 2, label: 'Zelenina' }];
  const pick = (root: HTMLElement, label: string) =>
    [...root.querySelectorAll<HTMLElement>('.pt-item')].find(item => item.textContent!.includes(label))!.querySelector<HTMLInputElement>('input')!;

  test('setDisabled() greys the boxes out and picks nothing; setReadOnly() keeps them as they are', () => {
    const form = new Form<{ categoryId: number | null; tagIds: number[] }>();
    const category = form.addTreeSelect('categoryId', 'Kategorie', { nodes: NODES }).setDisabled();
    const tags = form.addTreeMultiSelect('tagIds', 'Štítky', { nodes: NODES }).setReadOnly();
    const root = mount(() => <FormView form={form} />);
    const [first, second] = root.querySelectorAll<HTMLElement>('.phlox-treeselect');
    expect(pick(first!, 'Ovoce').disabled).toBe(true);
    pick(first!, 'Ovoce').click();
    first!.querySelector<HTMLElement>('.pt-label')!.click();
    expect(category.getValue()).toBe(null);
    expect(pick(second!, 'Ovoce').disabled).toBe(false);
    pick(second!, 'Ovoce').click();
    expect(tags.getValue()).toEqual([]);
    expect(pick(second!, 'Ovoce').checked).toBe(false);
    tags.setReadOnly(false);
    pick(second!, 'Ovoce').click();
    expect(tags.getValue()).toEqual([1]);
  });
});

describe('disabled items', () => {
  test('select, radio list and checkbox list: setDisabled([values]) as in Nette', () => {
    const form = new Form<{ size: string | null; color: string | null; days: string[] }>();
    const size = form.addSelect('size', 'Velikost', ['S', 'M', 'L']).setDisabled(['M']);
    const color = form.addRadioList('color', 'Barva', ['red', 'blue']).setDisabled(['blue']);
    const days = form.addCheckboxList('days', 'Dny', ['po', 'út']).setDisabled(['po']);
    const root = mount(() => <FormView form={form} />);
    expect([...root.querySelectorAll<HTMLOptionElement>(`#${size.htmlId} option`)].map(option => option.disabled)).toEqual([false, true, false]);
    expect(root.querySelector<HTMLInputElement>(`#${color.htmlId}-1`)!.disabled).toBe(true);
    expect(root.querySelector<HTMLInputElement>(`#${days.htmlId}-0`)!.disabled).toBe(true);
    expect(size.disabled()).toBe(false);
    expect(form.getValues()).toEqual({ size: null, color: null, days: [] });
  });

  test('DropDownList: shown but not picked, the arrows skip it', async () => {
    const form = new Form<{ city: number | null }>();
    const city = form.addDropDownList('city', 'Město', { items: [[1, 'Praha'], [2, 'Brno'], [3, 'Ostrava']], itemDisabled: (value: number) => value === 2 });
    const root = mount(() => <FormView form={form} />);
    root.querySelector<HTMLButtonElement>('button[role=combobox]')!.click();
    await tick();
    const options = () => [...root.querySelectorAll<HTMLElement>('[role=option][data-value]')];
    expect(options().map(option => option.getAttribute('aria-disabled'))).toEqual([null, 'true', null]);
    mousedown(options()[1]!);
    expect(city.getValue()).toBe(null);
    const filter = root.querySelector<HTMLInputElement>('.dropdownlist-filter-input')!;
    key(filter, 'ArrowDown');
    key(filter, 'ArrowDown');
    key(filter, 'Enter');
    expect(city.getValue()).toBe(3);
  });

  test('ComboBox with objects: a disabled item is not picked, not even by its typed name', async () => {
    interface Person { id: number; name: string; active: boolean }
    const people: Person[] = [{ id: 1, name: 'Jana', active: true }, { id: 2, name: 'Petr', active: false }];
    const form = new Form<{ personId: number | null }>();
    const person = form.addComboBox('personId', 'Osoba', {
      items: people, itemValue: item => item.id, itemLabel: item => item.name, itemDisabled: (item: Person) => !item.active,
    });
    const root = mount(() => <FormView form={form} />);
    const input = root.querySelector<HTMLInputElement>(`#${person.htmlId}`)!;
    input.focus();
    await tick();
    const options = [...root.querySelectorAll<HTMLElement>('[role=option][data-value]')];
    expect(options.map(option => option.getAttribute('aria-disabled'))).toEqual([null, 'true']);
    mousedown(options[1]!);
    expect(person.getValue()).toBe(null);
    type(input, 'Petr');
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(person.getValue()).toBe(null);
  });

  test('TagInput: a disabled suggestion is shown, Enter takes the first one that can be added', async () => {
    const form = new Form<{ tags: string[] }>();
    const tags = form.addTagInput('tags', 'Štítky', { items: ['php', 'python', 'perl'], itemDisabled: (value: string) => value === 'php' });
    const root = mount(() => <FormView form={form} />);
    const input = root.querySelector<HTMLInputElement>(`#${tags.htmlId}`)!;
    input.focus();
    type(input, 'p');
    await tick();
    const options = [...root.querySelectorAll<HTMLElement>('[data-phlox-taginput-dropdown] [role=option]')];
    expect(options.map(option => option.getAttribute('aria-disabled'))).toEqual(['true', null, null]);
    mousedown(options[0]!);
    expect(tags.getValue()).toEqual([]);
    key(input, 'Enter');
    expect(tags.getValue()).toEqual(['python']);
    type(input, 'php');
    key(input, 'Enter');
    expect(tags.getValue()).toEqual(['python']);
  });
});
