import { afterEach, describe, expect, test, vi } from 'vitest';
import { BootstrapTheme, Container, Presenter, render } from '../src/index';
import type { Child } from '../src/index';
import { DropDownList, Form, FormView } from '../src/forms/index';
import { boot, deferred, tick, until } from './helpers';

interface Task {
  city: number | null;
  name: string;
}

const cities: [number, string][] = [[1, 'Praha'], [2, 'Brno'], [3, 'Ostrava'], [4, 'Plzeň']];

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

function setup(options: ConstructorParameters<typeof DropDownList<number>>[1] = { items: cities, placeholder: 'Vyberte město' }) {
  const form = new Form<Task>();
  const city = form.addDropDownList('city', 'Město:', options);
  const root = mount(() => <FormView form={form} />);
  const trigger = root.querySelector<HTMLButtonElement>('button[role=combobox]')!;
  const panel = () => root.querySelector<HTMLElement>('[data-dropdownlist-panel]');
  const filter = () => root.querySelector<HTMLInputElement>('.dropdownlist-filter-input')!;
  const options_ = () => [...root.querySelectorAll<HTMLElement>('[role=option][data-value]')];
  return { form, city, root, trigger, panel, filter, options: options_ };
}

afterEach(() => {
  document.body.replaceChildren();
  DropDownList.texts.noResults = 'No results';
});

describe('DropDownList', () => {
  test('a button with the placeholder, the same HTML as phloxcz/forms-dropdownlist', () => {
    const { root, trigger, panel } = setup();
    expect(root.querySelector('.dropdownlist-wrapper')).not.toBeNull();
    expect(trigger.className).toBe('dropdownlist-trigger');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.querySelector('.dropdownlist-trigger-text.dropdownlist-trigger-placeholder')!.textContent).toBe('Vyberte město');
    expect(trigger.querySelector('.dropdownlist-trigger-arrow')).not.toBeNull();
    expect(root.querySelector(`label[for="${trigger.id}"]`)!.textContent).toBe('Město:');
    expect(panel()).toBeNull();
  });

  test('a click opens the list with the search field focused, a pick sets the value and closes it', async () => {
    const { city, trigger, panel, filter, options } = setup();
    trigger.click();
    await tick();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel()!.className).toBe('dropdownlist-dropdown');
    expect(document.activeElement).toBe(filter());
    expect(options().map(option => option.textContent)).toEqual(['Praha', 'Brno', 'Ostrava', 'Plzeň']);

    options()[1]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(city.getValue()).toBe(2);
    expect(trigger.textContent).toBe('Brno');
    expect(trigger.querySelector('.dropdownlist-trigger-placeholder')).toBeNull();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  test('typing filters fixed items and marks the found text, as text and not HTML', async () => {
    const { trigger, filter, options, root } = setup({ items: [...cities, [5, '<b>Kolín</b>']] });
    trigger.click();
    await tick();
    type(filter(), 'ra');
    expect(options().map(option => option.textContent)).toEqual(['Praha', 'Ostrava']);
    expect(options()[0]!.querySelector('mark')!.textContent).toBe('ra');
    type(filter(), 'kol');
    expect(root.querySelector('[role=option] b')).toBeNull();
    expect(options()[0]!.textContent).toBe('<b>Kolín</b>');
    type(filter(), 'xyz');
    expect(options()).toHaveLength(0);
    expect(root.querySelector('.dropdownlist-no-results')!.textContent).toBe('No results');
  });

  test('search ignores diacritics and case, the mark keeps the original text', async () => {
    const { trigger, filter, options } = setup({ items: [[1, 'Nápoje'], [2, 'Pečivo'], [3, 'Šunka']] });
    trigger.click();
    await tick();
    type(filter(), 'nap');
    expect(options().map(option => option.textContent)).toEqual(['Nápoje']);
    expect(options()[0]!.querySelector('mark')!.textContent).toBe('Náp');
    type(filter(), 'SUN');
    expect(options()[0]!.querySelector('mark')!.textContent).toBe('Šun');
    type(filter(), 'ečí');
    expect(options().map(option => option.textContent)).toEqual(['Pečivo']);
  });

  test('keyboard: ArrowDown opens, arrows move, Enter picks, Escape closes', async () => {
    const { city, trigger, filter, options, panel } = setup();
    key(trigger, 'ArrowDown');
    await tick();
    expect(panel()).not.toBeNull();
    key(filter(), 'ArrowDown');
    key(filter(), 'ArrowDown');
    key(filter(), 'ArrowDown');
    key(filter(), 'ArrowUp');
    expect(options()[1]!.className).toBe('dropdownlist-active');
    expect(filter().getAttribute('aria-activedescendant')).toBe(options()[1]!.id);
    key(filter(), 'Enter');
    expect(city.getValue()).toBe(2);
    expect(panel()).toBeNull();

    trigger.click();
    await tick();
    expect(options()[1]!.className).toBe('dropdownlist-selected');
    expect(options()[1]!.getAttribute('aria-selected')).toBe('true');
    key(filter(), 'Escape');
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(city.getValue()).toBe(2);
  });

  test('Tab picks the highlighted item, Enter on the button does not send the form', async () => {
    const { city, form, trigger, filter } = setup();
    const success = vi.fn();
    form.onSuccess = success;
    expect(key(trigger, 'Enter')).toBe(false);
    trigger.click();
    await tick();
    key(filter(), 'ArrowDown');
    key(filter(), 'Tab');
    expect(city.getValue()).toBe(1);
    expect(success).not.toHaveBeenCalled();
  });

  test('Escape in the list does not close a dialog around it', async () => {
    const { trigger, filter } = setup();
    trigger.click();
    await tick();
    const dialogCancel = vi.fn();
    document.body.addEventListener('keydown', dialogCancel);
    key(filter(), 'Escape');
    expect(dialogCancel).not.toHaveBeenCalled();
  });

  test('the list closes and validates when the focus leaves the widget, not when it opens', async () => {
    const form = new Form<Task>();
    const city = form.addDropDownList('city', 'Město:', { items: cities }).setRequired('Vyberte město.');
    const root = mount(() => <FormView form={form} />);
    const trigger = root.querySelector<HTMLButtonElement>('button[role=combobox]')!;
    trigger.click();
    await tick();
    // the focus went from the button to the search field, inside the widget
    trigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: root.querySelector('.dropdownlist-filter-input') }));
    expect(city.errors()).toEqual([]);
    expect(root.querySelector('[data-dropdownlist-panel]')).not.toBeNull();

    root.querySelector('.dropdownlist-filter-input')!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    expect(root.querySelector('[data-dropdownlist-panel]')).toBeNull();
    expect(city.errors()).toEqual(['Vyberte město.']);
    expect(trigger.className).toBe('dropdownlist-trigger phlox-invalid');
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
  });

  test('items from search: debounced, an older answer never overwrites a newer one', async () => {
    const answers = new Map<string, ReturnType<typeof deferred<[number, string][]>>>();
    const search = vi.fn((query: string) => {
      const answer = deferred<[number, string][]>();
      answers.set(query, answer);
      return answer.promise;
    });
    const { trigger, filter, options } = setup({ search });
    trigger.click();
    await tick();
    expect(search).toHaveBeenCalledWith('');
    answers.get('')!.resolve(cities);
    await tick();
    expect(options()).toHaveLength(4);

    type(filter(), 'b');
    type(filter(), 'br');
    await until(() => search.mock.calls.length === 2);
    expect(search).toHaveBeenLastCalledWith('br');

    type(filter(), 'p');
    await until(() => search.mock.calls.length === 3);
    answers.get('p')!.resolve([[1, 'Praha'], [4, 'Plzeň']]);
    answers.get('br')!.resolve([[2, 'Brno']]);
    await tick();
    expect(options().map(option => option.textContent)).toEqual(['Praha', 'Plzeň']);
  });

  test('a value set from code shows its label: from the items, or from the label option', async () => {
    const fixed = setup();
    fixed.form.setDefaults({ city: 3 });
    expect(fixed.trigger.textContent).toBe('Ostrava');

    const label = vi.fn(async (id: number) => `Město ${id}`);
    const remote = setup({ search: async () => [], label });
    remote.form.setDefaults({ city: 9 });
    await tick();
    expect(label).toHaveBeenCalledWith(9);
    expect(remote.trigger.textContent).toBe('Město 9');
    expect(remote.form.getValues()).toEqual({ city: 9 });
  });

  test('the panel opens below, above when there is no room below, and gets shorter when it fits nowhere', async () => {
    const { trigger, panel, root } = setup();
    const at = (top: number) => {
      trigger.getBoundingClientRect = () => ({ top, bottom: top + 36, left: 40, right: 240, width: 200, height: 36, x: 40, y: top, toJSON() {} });
    };
    const open = async () => {
      trigger.click();
      await tick();
      return panel()!;
    };
    const close = () => key(root.querySelector('.dropdownlist-filter-input')!, 'Escape');
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    at(100);
    let shown = await open();
    expect(shown.dataset.placement).toBe('bottom');
    expect(shown.style.top).toBe('138px');
    expect(shown.style.left).toBe('40px');
    expect(shown.style.width).toBe('200px');
    close();

    at(700);
    shown = await open();
    expect(shown.dataset.placement).toBe('top');
    expect(shown.style.bottom).toBe('102px');
    expect(shown.style.top).toBe('auto');
    expect(shown.querySelector<HTMLElement>('.dropdownlist-list')!.style.maxHeight).toBe('');
    close();

    Object.defineProperty(window, 'innerHeight', { value: 250, configurable: true });
    at(100);
    shown = await open();
    expect(shown.dataset.placement).toBe('bottom');
    expect(shown.querySelector<HTMLElement>('.dropdownlist-list')!.style.maxHeight).toBe('110px');
    close();
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
  });

  test('disabled: it does not open', async () => {
    const { city, trigger, panel } = setup();
    city.setDisabled();
    expect(trigger.disabled).toBe(true);
    city.open();
    await tick();
    expect(panel()).toBeNull();
  });

  test('texts can be replaced for the language of the application', async () => {
    DropDownList.texts.noResults = 'Žádné výsledky';
    const { trigger, filter, root } = setup();
    trigger.click();
    await tick();
    type(filter(), 'xyz');
    expect(root.querySelector('.dropdownlist-no-results')!.textContent).toBe('Žádné výsledky');
  });

  test('Bootstrap: the classes of THEME_BOOTSTRAP from phloxcz/forms-dropdownlist', async () => {
    const form = new Form<Task>();
    form.addDropDownList('city', 'Město:', { items: cities });
    class Page extends Presenter {
      render() { return <FormView form={form} />; }
    }
    const { element } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    const trigger = element.querySelector<HTMLButtonElement>('button[role=combobox]')!;
    expect(trigger.parentElement!.className).toBe('dropdownlist-wrapper position-relative');
    expect(trigger.className).toBe('form-select text-start dropdownlist-bs-trigger');
    trigger.click();
    await tick();
    expect(element.querySelector('[data-dropdownlist-panel]')!.className).toBe('dropdown-menu py-0');
    expect(element.querySelector('.dropdownlist-filter-input, .form-control-sm')!.className).toBe('form-control form-control-sm');
    expect(element.querySelector('[role=option]')!.className).toBe('dropdown-item');
    expect(await form.submit()).toBe(true);
  });

  test('the value has the type of the DTO', () => {
    const form = new Form<Task>();
    // @ts-expect-error items must have the type of the field
    void (() => form.addDropDownList('city', '', { items: [['x', 'X']] }));
    const city: DropDownList<number> = form.addDropDownList('city', '', { items: cities });
    void city;
  });
});

describe('DropDownList with a selected value far in remote data', () => {
  test('the label can be given with the value and the value is first in the list', async () => {
    const firstTwo = async () => cities.slice(0, 2);
    const { city, trigger, options } = setup({ search: firstTwo });
    city.setValue(4, 'Plzeň');
    expect(trigger.textContent).toBe('Plzeň');
    trigger.click();
    await tick();
    expect(options().map(option => option.textContent)).toEqual(['Plzeň', 'Praha', 'Brno']);
    expect(options()[0]!.getAttribute('aria-selected')).toBe('true');
  });
});
