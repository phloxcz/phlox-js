import { afterEach, describe, expect, test, vi } from 'vitest';
import { BootstrapTheme, Container, Presenter, render } from '../src/index';
import type { Child } from '../src/index';
import { Form, FormView } from '../src/forms/index';
import type { ComboBoxOptions } from '../src/forms/index';
import { boot, tick, until } from './helpers';

interface Order {
  country: number | null;
  city: string | null;
}

const countries: [number, string][] = [[1, 'Česko'], [2, 'Slovensko'], [3, 'Německo'], [4, 'Rakousko']];

function mount(view: () => Child) {
  const root = document.createElement('div');
  document.body.append(root);
  render(view, root);
  return root;
}

const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
const type = (input: HTMLInputElement, text: string) => {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const leave = (element: Element) => element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));

function setup(options: ComboBoxOptions<number> & { allowCustom?: false } = { items: countries, placeholder: 'Země' }) {
  const form = new Form<Order>();
  const country = form.addComboBox('country', 'Země:', options);
  form.addSubmit('save', 'Uložit');
  const root = mount(() => <FormView form={form} />);
  const input = root.querySelector<HTMLInputElement>('input[role=combobox]')!;
  const panel = () => root.querySelector<HTMLElement>('[data-combobox-panel]');
  const options_ = () => [...root.querySelectorAll<HTMLElement>('[role=option][data-value]')];
  return { form, country, root, input, panel, options: options_ };
}

afterEach(() => document.body.replaceChildren());

describe('ComboBox', () => {
  test('a text field with the HTML of phloxcz/forms-combobox', () => {
    const { root, input, panel } = setup();
    expect(root.querySelector('.combobox-wrapper')).not.toBeNull();
    expect(input.className).toBe('combobox-input');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.placeholder).toBe('Země');
    expect(root.querySelector(`label[for="${input.id}"]`)!.textContent).toBe('Země:');
    expect(panel()).toBeNull();
  });

  test('focus opens the list, typing filters it, a pick sets value and text', async () => {
    const { country, input, panel, options } = setup();
    input.focus();
    await tick();
    expect(panel()!.className).toBe('combobox-dropdown');
    expect(options()).toHaveLength(4);

    type(input, 'n');
    expect(options().map(option => option.textContent)).toEqual(['Slovensko', 'Německo']);
    expect(country.getValue()).toBeNull();

    options()[1]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(country.getValue()).toBe(3);
    expect(input.value).toBe('Německo');
    expect(panel()).toBeNull();
  });

  test('keyboard: arrows, Enter picks, Escape returns the previous value', async () => {
    const { country, input, panel, options } = setup();
    country.setValue(1);
    expect(input.value).toBe('Česko');
    input.focus();
    await tick();
    type(input, 'n');
    key(input, 'ArrowDown');
    key(input, 'ArrowDown');
    key(input, 'ArrowUp');
    expect(options()[0]!.className).toBe('combobox-active');
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[0]!.id);
    key(input, 'Enter');
    expect(country.getValue()).toBe(2);
    expect(input.value).toBe('Slovensko');

    input.click();
    await tick();
    type(input, 'xyz');
    expect(country.getValue()).toBeNull();
    key(input, 'Escape');
    expect(panel()).toBeNull();
    expect(country.getValue()).toBe(2);
    expect(input.value).toBe('Slovensko');
  });

  test('Escape after a pick and new typing returns the picked item', async () => {
    const { country, input, options } = setup();
    input.focus();
    await tick();
    type(input, 'slo');
    options()[0]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(country.getValue()).toBe(2);
    // The field still has the focus, the list is closed, the user types again
    type(input, 'xyz');
    key(input, 'Escape');
    expect(country.getValue()).toBe(2);
    expect(input.value).toBe('Slovensko');
  });

  test('typed text that is not an item is thrown away when leaving, an exact label is picked', async () => {
    const { country, input } = setup();
    country.setValue(2);
    input.focus();
    await tick();
    type(input, 'Nic takového');
    leave(input);
    expect(country.getValue()).toBe(2);
    expect(input.value).toBe('Slovensko');

    input.focus();
    await tick();
    type(input, 'nemecko');
    leave(input);
    expect(country.getValue()).toBe(3);
    expect(input.value).toBe('Německo');

    input.focus();
    await tick();
    type(input, '');
    leave(input);
    expect(country.getValue()).toBeNull();
    expect(input.value).toBe('');
  });

  test('allowCustom: typed text becomes the value', async () => {
    const form = new Form<Order>();
    const city = form.addComboBox('city', 'Město:', { items: [['Praha', 'Praha'], ['Brno', 'Brno']], allowCustom: true });
    const root = mount(() => <FormView form={form} />);
    const input = root.querySelector<HTMLInputElement>('input[role=combobox]')!;
    input.focus();
    await tick();
    type(input, 'Kolín');
    expect(city.getValue()).toBe('Kolín');
    leave(input);
    expect(city.getValue()).toBe('Kolín');
    expect(city.isCustom()).toBe(true);
    expect(input.value).toBe('Kolín');

    input.focus();
    await tick();
    type(input, 'brno');
    leave(input);
    expect(city.getValue()).toBe('Brno');
    expect(city.isCustom()).toBe(false);
  });

  test('allowCustom is allowed only for fields that can hold a text', () => {
    const form = new Form<Order>();
    // @ts-expect-error country is a number, a typed text cannot be its value
    void (() => form.addComboBox('country', '', { items: countries, allowCustom: true }));
    void form.addComboBox('city', '', { allowCustom: true });
  });

  test('Enter in a field with unsettled text sends the form after settling it', async () => {
    const { form, country, input } = setup();
    country.setRequired('Vyberte zemi.');
    const success = vi.fn();
    form.onSuccess = success;
    input.focus();
    await tick();
    type(input, 'cesko');
    expect(await form.submit()).toBe(true);
    expect(success).toHaveBeenCalledWith({ country: 1 }, form);

    input.focus();
    await tick();
    type(input, 'xyz');
    country.setValue(null);
    input.focus();
    await tick();
    type(input, 'xyz');
    expect(await form.submit()).toBe(false);
    expect(country.errors()).toEqual(['Vyberte zemi.']);
  });

  test('Escape in a closed field is left to a dialog around it', async () => {
    const { input, panel } = setup();
    input.focus();
    await tick();
    const outside = vi.fn();
    document.body.addEventListener('keydown', outside);
    key(input, 'Escape');
    expect(outside).not.toHaveBeenCalled();
    expect(panel()).toBeNull();
    key(input, 'Escape');
    expect(outside).toHaveBeenCalledTimes(1);
    document.body.removeEventListener('keydown', outside);
  });

  test('items from search, debounced', async () => {
    const search = vi.fn(async (query: string) => countries.filter(([, name]) => name.toLowerCase().includes(query)));
    const { input, options } = setup({ search });
    input.focus();
    await tick();
    expect(search).toHaveBeenCalledWith('');
    type(input, 's');
    type(input, 'sl');
    await until(() => search.mock.calls.length === 2);
    await tick();
    expect(search).toHaveBeenLastCalledWith('sl');
    expect(options().map(option => option.textContent)).toEqual(['Slovensko']);
  });

  test('Bootstrap: the classes of THEME_BOOTSTRAP from phloxcz/forms-combobox', async () => {
    const form = new Form<Order>();
    form.addComboBox('country', 'Země:', { items: countries });
    class Page extends Presenter {
      render() { return <FormView form={form} />; }
    }
    const { element } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    const input = element.querySelector<HTMLInputElement>('input[role=combobox]')!;
    expect(input.parentElement!.className).toBe('combobox-wrapper position-relative');
    expect(input.className).toBe('form-control');
    input.focus();
    await tick();
    expect(element.querySelector('[data-combobox-panel]')!.className).toBe('dropdown-menu');
    expect(element.querySelector('[role=option]')!.className).toBe('dropdown-item');
  });
});

describe('a selected value far in remote data', () => {
  // A search returns at most the first two records, the saved value is the fourth
  const firstTwo = async (query: string) =>
    countries.filter(([, name]) => name.toLowerCase().includes(query.toLowerCase())).slice(0, 2);

  test('the label given with the value needs no request, the value is first in the list', async () => {
    const label = vi.fn(async () => 'never');
    const { country, input, options } = setup({ search: firstTwo, label });
    country.setValue(4, 'Rakousko');
    expect(input.value).toBe('Rakousko');
    input.focus();
    await tick();
    expect(options().map(option => option.textContent)).toEqual(['Rakousko', 'Česko', 'Slovensko']);
    expect(options()[0]!.className).toBe('combobox-selected');
    expect(label).not.toHaveBeenCalled();
  });

  test('without a label it comes from the label option, after setDefaults too', async () => {
    const { form, input, options } = setup({ search: firstTwo, label: async id => countries.find(([key]) => key === id)?.[1] ?? null });
    form.setDefaults({ country: 4 });
    await tick();
    expect(input.value).toBe('Rakousko');
    input.focus();
    await tick();
    expect(options()[0]!.textContent).toBe('Rakousko');
  });

  test('while searching, only what matches is shown', async () => {
    const { country, input, options } = setup({ search: firstTwo });
    country.setValue(4, 'Rakousko');
    input.focus();
    await tick();
    type(input, 'slo');
    await until(() => options().length === 1);
    expect(options()[0]!.textContent).toBe('Slovensko');
  });
});
