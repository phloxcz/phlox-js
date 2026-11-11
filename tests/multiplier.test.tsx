import { afterEach, describe, expect, test, vi } from 'vitest';
import { computed, render } from '../src/index';
import type { Child } from '../src/index';
import { Form, FormView, Input, MultiplierView, Multiplier } from '../src/forms/index';
import { RpcError } from '../src/net/index';
import { tick } from './helpers';

interface Line {
  name: string;
  quantity: number | null;
  price: number | null;
}

interface Invoice {
  number: string;
  customer: { name: string; city: string };
  lines: Line[];
}

function invoiceForm(options = { min: 1, max: 3 }) {
  const form = new Form<Invoice>();
  form.addText('number', 'Číslo:');
  const customer = form.addContainer('customer', 'Odběratel');
  customer.addText('name', 'Název:').setRequired('Vyplňte odběratele.');
  customer.addText('city', 'Město:');
  const lines = form.addMultiplier('lines', line => {
    line.addText('name', 'Položka').setRequired('Vyplňte položku.');
    line.addInteger('quantity', 'Množství').addRule(Form.Min, 'Aspoň %d.', 1);
    line.addFloat('price', 'Cena');
  }, { ...options, label: 'Řádky' });
  return { form, customer, lines };
}

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

afterEach(() => document.body.replaceChildren());

describe('addContainer', () => {
  test('nested values, defaults and validation', async () => {
    const { form, customer } = invoiceForm();
    form.setDefaults({ number: '2026-001', customer: { name: 'ACME', city: 'Brno' } });
    expect(form.getValues().customer).toEqual({ name: 'ACME', city: 'Brno' });
    customer.get('name').setValue('');
    expect(await form.submit()).toBe(false);
    expect(customer.get('name').errors()).toEqual(['Vyplňte odběratele.']);
  });

  test('ids and names follow the path, like customer[city] in Nette', () => {
    const { form, customer } = invoiceForm();
    const city = customer.get('city');
    expect(city.htmlId).toBe(`${form.id}-customer-city`);
    expect(city.htmlName).toBe('customer[city]');
    expect(form.get('number').htmlName).toBe('number');
  });

  test('types: containers only for objects, controls by the nested DTO', () => {
    const { form, customer } = invoiceForm();
    // @ts-expect-error number is not an object
    void (() => form.addContainer('number'));
    // @ts-expect-error no such field in the customer
    void (() => customer.addText('street'));
    void form.getContainer('customer');
  });
});

describe('addMultiplier', () => {
  test('starts with min rows, adds up to max, removes down to min', () => {
    const { lines } = invoiceForm();
    expect(lines.rows()).toHaveLength(1);
    expect(lines.add({ name: 'B' })).not.toBeNull();
    expect(lines.add({ name: 'C' })).not.toBeNull();
    expect(lines.add({ name: 'D' })).toBeNull();
    expect(lines.canAdd()).toBe(false);
    for (const row of lines.rows()) lines.remove(row);
    expect(lines.rows()).toHaveLength(1);
    expect(lines.canRemove()).toBe(false);
  });

  test('values in the order of the rows, move changes it', () => {
    const { form, lines } = invoiceForm({ min: 0, max: 0 });
    form.setDefaults({ lines: [{ name: 'A', quantity: 1, price: 10 }, { name: 'B', quantity: 2, price: 5 }, { name: 'C', quantity: 3, price: 1 }] });
    expect(lines.getValues().map(line => line.name)).toEqual(['A', 'B', 'C']);
    lines.move(lines.rows()[2]!, 0);
    expect(form.getValues().lines.map(line => line.name)).toEqual(['C', 'A', 'B']);
    lines.move(lines.rows()[0]!, 99);
    expect(lines.getValues().map(line => line.name)).toEqual(['A', 'B', 'C']);
  });

  test('setValues reuses rows and fills up to min', () => {
    const { lines } = invoiceForm({ min: 2, max: 0 });
    const first = lines.rows()[0];
    lines.setValues([{ name: 'X' }]);
    expect(lines.rows()).toHaveLength(2);
    expect(lines.rows()[0]).toBe(first);
    expect(lines.getValues()).toEqual([{ name: 'X', quantity: null, price: null }, { name: '', quantity: null, price: null }]);
  });

  test('a total computed from the rows follows typing', () => {
    const { form, lines } = invoiceForm({ min: 0, max: 0 });
    form.setDefaults({ lines: [{ name: 'A', quantity: 2, price: 10 }, { name: 'B', quantity: 1, price: 5 }] });
    const total = computed(() => lines.getValues().reduce((sum, line) => sum + (line.quantity ?? 0) * (line.price ?? 0), 0));
    expect(total()).toBe(25);
    lines.rows()[1]!.get('quantity').setValue(3);
    expect(total()).toBe(35);
    lines.remove(lines.rows()[0]!);
    expect(total()).toBe(15);
  });

  test('every row is validated, and the number of rows', async () => {
    const { form, lines } = invoiceForm({ min: 2, max: 0 });
    form.getContainer('customer').get('name').setValue('ACME');
    lines.setValues([{ name: 'A', quantity: 0 }]);
    expect(await form.submit()).toBe(false);
    expect(lines.rows()[0]!.get('quantity').errors()).toEqual(['Aspoň 1.']);
    expect(lines.rows()[1]!.get('name').errors()).toEqual(['Vyplňte položku.']);
  });

  test('too few rows is an error of the multiplier', () => {
    const form = new Form<Invoice>();
    const lines = form.addMultiplier('lines', line => { line.addText('name'); }, { min: 0, max: 0 });
    (lines as unknown as { min: number }).min = 1;
    expect(form.validate()).toBe(false);
    expect(lines.errors()).toEqual(['Please add at least 1 rows.']);
    lines.add();
    expect(lines.errors()).toEqual([]);
  });

  test('server errors reach the right row', async () => {
    const { form, lines } = invoiceForm({ min: 0, max: 0 });
    form.setDefaults({ customer: { name: 'ACME' }, lines: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
    form.onSuccess = async () => {
      throw new RpcError(-32602, 'Invalid method parameter(s).', {
        fields: { 'input.lines.2.quantity': 'must be positive.', 'input.customer.city': 'is required.', 'input.lines': 'too many.' },
      });
    };
    expect(await form.submit()).toBe(false);
    expect(lines.rows()[2]!.get('quantity').errors()).toEqual(['must be positive.']);
    expect(form.getContainer('customer').get('city').errors()).toEqual(['is required.']);
    expect(lines.errors()).toEqual(['too many.']);
  });

  test('ids of rows stay unique after moving, names are lines[key][field]', () => {
    const { form, lines } = invoiceForm({ min: 2, max: 0 });
    const [first, second] = lines.rows();
    expect(first!.get('name').htmlId).not.toBe(second!.get('name').htmlId);
    expect(first!.get('name').htmlId.startsWith(`${form.id}-lines-`)).toBe(true);
    expect(first!.get('name').htmlName).toMatch(/^lines\[\d+\]\[name\]$/);
  });

  test('types: rows only for lists of objects, row controls by the row DTO', () => {
    const form = new Form<Invoice & { tags: string[] }>();
    // @ts-expect-error tags are texts, not objects
    void (() => form.addMultiplier('tags', () => {}));
    // @ts-expect-error no such field in a line
    void (() => form.addMultiplier('lines', line => line.addText('nmae')));
    const lines: Multiplier<Line> = form.addMultiplier('lines', line => { line.addText('name'); });
    void lines;
  });
});

describe('rendering of rows', () => {
  test('FormView: a group for the container, rows with buttons, add button', () => {
    const { form, lines } = invoiceForm({ min: 1, max: 2 });
    const root = mount(() => <FormView form={form} />);
    expect(root.querySelector('.phlox-group legend')!.textContent).toBe('Odběratel');
    expect(root.querySelector('.phlox-multiplier legend')!.textContent).toBe('Řádky');
    const rows = () => [...root.querySelectorAll('[data-phlox-row]')];
    expect(rows()).toHaveLength(1);
    const add = [...root.querySelectorAll('button')].find(button => button.textContent === '+ Add')!;
    add.click();
    expect(rows()).toHaveLength(2);
    expect(add.disabled).toBe(true);
    expect(lines.rows()).toHaveLength(2);
    const remove = rows()[0]!.querySelector<HTMLButtonElement>('[aria-label=Remove]')!;
    remove.click();
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.querySelector<HTMLButtonElement>('[aria-label=Remove]')!.disabled).toBe(true);
  });

  test('buttons and arrow keys on the handle move a row, the DOM of the rows is kept', async () => {
    const { form, lines } = invoiceForm({ min: 0, max: 0 });
    form.setDefaults({ lines: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
    const root = mount(() => <FormView form={form} />);
    const names = () => [...root.querySelectorAll<HTMLInputElement>('[data-phlox-row] input[name$="[name]"]')].map(input => input.value);
    const rowOf = (name: string) => [...root.querySelectorAll<HTMLElement>('[data-phlox-row]')].find(row => row.querySelector('input')!.value === name)!;
    const b = rowOf('B');
    type(b.querySelector('input')!, 'B rozepsané');
    b.querySelector<HTMLButtonElement>('[aria-label="Move up"]')!.click();
    expect(names()).toEqual(['B rozepsané', 'A', 'C']);
    expect(rowOf('B rozepsané')).toBe(b);

    const handle = b.querySelector<HTMLButtonElement>('[title^="Drag"]')!;
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await tick();
    expect(names()).toEqual(['A', 'C', 'B rozepsané']);
    expect(document.activeElement).toBe(handle);
    expect(lines.getValues().map(line => line.name)).toEqual(['A', 'C', 'B rozepsané']);
  });

  test('dragging the handle moves the row by the middles of the other rows', () => {
    const { form, lines } = invoiceForm({ min: 0, max: 0 });
    form.setDefaults({ lines: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
    const root = mount(() => <FormView form={form} />);
    const rows = [...root.querySelectorAll<HTMLElement>('[data-phlox-row]')];
    // Rows 40 px high; like in a browser the box includes the shift by transform
    rows.forEach((row, index) => {
      row.getBoundingClientRect = () => {
        const [x = 0, y = 0] = (/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(row.style.transform) ?? []).slice(1).map(Number);
        return new DOMRect(x, index * 40 + y, 300, 40);
      };
    });
    const handle = rows[0]!.querySelector<HTMLButtonElement>('[title^="Drag"]')!;
    // Only the press is on the handle. Moving the row in the DOM loses a pointer capture in browsers,
    // so the rest comes from elsewhere in the page.
    const pointer = (type: string, y: number) => (type === 'pointerdown' ? handle : document.body)
      .dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientY: y, button: 0 }));

    pointer('pointerdown', 20);
    expect(rows[0]!.classList.contains('phlox-dragging')).toBe(true);
    pointer('pointermove', 70);
    expect(lines.getValues().map(line => line.name)).toEqual(['B', 'A', 'C']);
    pointer('pointermove', 115);
    expect(lines.getValues().map(line => line.name)).toEqual(['B', 'C', 'A']);
    pointer('pointerup', 115);
    expect(rows[0]!.classList.contains('phlox-dragging')).toBe(false);
    pointer('pointermove', 0);
    expect(lines.getValues().map(line => line.name)).toEqual(['B', 'C', 'A']);
  });

  test('rows drawn by hand, e.g. as a table', () => {
    const { form, lines } = invoiceForm({ min: 2, max: 0 });
    const root = mount(() => (
      <MultiplierView multiplier={lines}>
        {row => <><Input control={row.get('name')} class="name" /><Input control={row.get('quantity')} class="qty" /></>}
      </MultiplierView>
    ));
    expect(root.querySelectorAll('input.name')).toHaveLength(2);
    expect(root.querySelector('label')).toBeNull();
    void form;
  });

  test('the add button focuses the first field of the new row', async () => {
    const { form } = invoiceForm({ min: 0, max: 0 });
    const root = mount(() => <FormView form={form} />);
    [...root.querySelectorAll('button')].find(button => button.textContent === '+ Add')!.click();
    await tick();
    expect(document.activeElement).toBe(root.querySelector('[data-phlox-row] input'));
  });

  test('texts can be replaced', () => {
    const original = Multiplier.texts.add;
    Multiplier.texts.add = 'Přidat řádek';
    const { form } = invoiceForm();
    const root = mount(() => <FormView form={form} />);
    expect([...root.querySelectorAll('button')].some(button => button.textContent === '+ Přidat řádek')).toBe(true);
    Multiplier.texts.add = original;
    void vi;
  });
});
