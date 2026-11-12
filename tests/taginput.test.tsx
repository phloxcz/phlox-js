import { afterEach, describe, expect, test, vi } from 'vitest';
import { BootstrapTheme, Container, Presenter, render } from '../src/index';
import type { Child } from '../src/index';
import { Form, FormView, TagInput } from '../src/forms/index';
import type { TagInputOptions } from '../src/forms/index';
import { boot, tick, until } from './helpers';

interface Article {
  labels: string[];
  categories: number[];
}

const categories: [number, string][] = [[1, 'PHP'], [2, 'Nette'], [3, 'MySQL'], [4, 'JavaScript']];

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

function setup(options: TagInputOptions<number> & { allowNew?: false } = { items: categories, placeholder: 'Přidat štítek…' }) {
  const form = new Form<Article>();
  const control = form.addTagInput('categories', 'Kategorie:', options);
  const root = mount(() => <FormView form={form} />);
  const input = root.querySelector<HTMLInputElement>('input[role=combobox]')!;
  const tags = () => [...root.querySelectorAll<HTMLElement>('[data-phlox-taginput-tag]')].map(tag => tag.querySelector('[data-phlox-tag-label]')!.textContent);
  const options_ = () => [...root.querySelectorAll<HTMLElement>('[role=option]')];
  return { form, control, root, input, tags, options: options_ };
}

function setupLabels(options: TagInputOptions<string> = { items: [['bio', 'bio'], ['akce', 'akce'], ['sleva', 'sleva']], allowNew: true }) {
  const form = new Form<Article>();
  const control = form.addTagInput('labels', 'Štítky:', options);
  const root = mount(() => <FormView form={form} />);
  const input = root.querySelector<HTMLInputElement>('input[role=combobox]')!;
  const options_ = () => [...root.querySelectorAll<HTMLElement>('[role=option]')];
  return { form, control, root, input, options: options_ };
}

afterEach(() => {
  document.body.replaceChildren();
  TagInput.texts.createNew = 'Create: ';
});

describe('TagInput', () => {
  test('the HTML of phloxcz/forms-taginput', () => {
    const { root, input } = setup();
    expect(root.querySelector('[data-phlox-taginput]')!.className).toBe('phlox-taginput phlox-taginput--theme-default');
    expect(root.querySelector('[data-phlox-taginput-container]')!.className).toBe('phlox-taginput__container');
    expect(input.className).toBe('phlox-taginput__input');
    expect(input.placeholder).toBe('Přidat štítek…');
    expect(root.querySelector(`label[for="${input.id}"]`)!.textContent).toBe('Kategorie:');
  });

  test('suggestions appear while typing, without tags already added', async () => {
    const { control, input, tags, options } = setup();
    input.focus();
    expect(options()).toHaveLength(0);
    type(input, 'p');
    expect(options().map(option => option.textContent)).toEqual(['PHP', 'JavaScript']);
    options()[0]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(tags()).toEqual(['PHP']);
    expect(control.getValue()).toEqual([1]);
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('');
    type(input, 'p');
    expect(options().map(option => option.textContent)).toEqual(['JavaScript']);
  });

  test('keyboard: arrows wrap, Enter adds, Backspace in an empty field removes the last tag', async () => {
    const { control, input, tags, options } = setup();
    type(input, 'a');
    expect(options().map(option => option.textContent)).toEqual(['JavaScript']);
    type(input, 't');
    expect(options().map(option => option.textContent)).toEqual(['Nette', 'JavaScript']);
    key(input, 'ArrowDown');
    key(input, 'ArrowDown');
    expect(options()[0]!.className).toBe('phlox-taginput__option');
    expect(options()[1]!.className).toBe('phlox-taginput__option phlox-taginput__option--active');
    key(input, 'ArrowDown');
    expect(options()[0]!.className).toContain('--active');
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[0]!.id);
    key(input, 'Enter');
    expect(tags()).toEqual(['Nette']);

    type(input, 'my');
    key(input, 'Enter');
    expect(control.getValue()).toEqual([2, 3]);

    key(input, 'Backspace');
    expect(control.getValue()).toEqual([2]);
  });

  test('a comma adds a tag, the comma never stays in the field', () => {
    const { control, input } = setup();
    type(input, 'mysql,');
    expect(control.getValue()).toEqual([3]);
    expect(input.value).toBe('');
    type(input, 'nic,');
    expect(control.getValue()).toEqual([3]);
    expect(input.value).toBe('nic');
  });

  test('without allowNew text that is no suggestion adds nothing, an exact label is added', () => {
    const { control, input } = setup();
    type(input, 'Nové');
    key(input, 'Escape');
    key(input, 'Enter');
    expect(control.getValue()).toEqual([]);
    type(input, 'javascript');
    key(input, 'Escape');
    key(input, 'Enter');
    expect(control.getValue()).toEqual([4]);
  });

  test('allowNew: typed text becomes a new tag, offered as "Create:"', () => {
    const { control, input, options, root } = setupLabels();
    type(input, 'na víkend');
    const last = options().at(-1)!;
    expect(last.className).toBe('phlox-taginput__option phlox-taginput__option--new');
    expect(last.textContent).toBe('Create: "na víkend"');
    key(input, 'Enter');
    type(input, 'bio');
    expect(options().map(option => option.textContent)).toEqual(['bio']);
    key(input, 'Enter');
    expect(control.getValue()).toEqual(['na víkend', 'bio']);
    expect(control.getSplitValue()).toEqual({ picked: ['bio'], created: ['na víkend'] });
    const [created, picked] = root.querySelectorAll('[data-phlox-taginput-tag]');
    expect(created!.className).toBe('phlox-taginput__tag phlox-tag-new');
    expect(picked!.className).toBe('phlox-taginput__tag phlox-tag-existing');
  });

  test('duplicates are refused regardless of case and diacritics', () => {
    const { control, input } = setupLabels();
    type(input, 'Akce,');
    type(input, 'AKCE,');
    type(input, 'Káva,');
    type(input, 'kava,');
    expect(control.getValue()).toEqual(['akce', 'Káva']);
  });

  test('maxTags: no more tags, no more suggestions', () => {
    const { control, input, options } = setup({ items: categories, maxTags: 2 });
    type(input, 'php,');
    type(input, 'nette,');
    type(input, 'my');
    expect(options()).toHaveLength(0);
    key(input, 'Enter');
    expect(control.getValue()).toEqual([1, 2]);
  });

  test('the remove button removes its tag and keeps the focus in the field', () => {
    const { control, input, root } = setup();
    control.setValue([1, 2, 3]);
    const remove = root.querySelectorAll<HTMLButtonElement>('[data-phlox-taginput-remove]')[1]!;
    expect(remove.getAttribute('aria-label')).toBe('Remove Nette');
    expect(remove.tabIndex).toBe(-1);
    expect(remove.textContent).toBe('×');
    remove.click();
    expect(control.getValue()).toEqual([1, 3]);
    expect(document.activeElement).toBe(input);
  });

  test('values set from code get labels from the items, given labels, or the label option', async () => {
    const label = vi.fn(async (id: number) => `Kategorie ${id}`);
    const { control, tags } = setup({ search: async () => [], label });
    control.setValue([10, 11], ['Deset', 'Jedenáct']);
    expect(tags()).toEqual(['Deset', 'Jedenáct']);
    expect(label).not.toHaveBeenCalled();
    control.setValue([12]);
    await tick();
    expect(tags()).toEqual(['Kategorie 12']);

    const fixed = setup();
    fixed.form.setDefaults({ categories: [2, 4] });
    expect(fixed.tags()).toEqual(['Nette', 'JavaScript']);
  });

  test('suggestions from search are debounced and an older answer never wins', async () => {
    const search = vi.fn(async (query: string) => categories.filter(([, name]) => name.toLowerCase().includes(query)));
    const { input, options } = setup({ search });
    type(input, 'p');
    type(input, 'ph');
    await until(() => search.mock.calls.length === 1);
    await tick();
    expect(search).toHaveBeenCalledWith('ph');
    expect(options().map(option => option.textContent)).toEqual(['PHP']);
  });

  test('rules work with the list: required, at least and at most', async () => {
    const form = new Form<Article>();
    const control = form.addTagInput('categories', 'Kategorie:', { items: categories })
      .setRequired('Vyberte kategorii.')
      .addRule(Form.MaxLength, 'Nejvýš %d kategorie.', 2);
    const root = mount(() => <FormView form={form} />);
    expect(await form.submit()).toBe(false);
    expect(control.errors()).toEqual(['Vyberte kategorii.']);
    // The form moved the focus to the invalid field, so the container is also focused
    expect(root.querySelector('[data-phlox-taginput-container]')!.className).toBe('phlox-taginput__container phlox-taginput--focused phlox-invalid');
    control.setValue([1, 2, 3]);
    expect(await form.submit()).toBe(false);
    expect(control.errors()).toEqual(['Nejvýš 2 kategorie.']);
  });

  test('text left in the field becomes a tag when the form is sent', async () => {
    const { form, input } = setupLabels();
    const success = vi.fn();
    form.onSuccess = success;
    type(input, 'poslední');
    expect(await form.submit()).toBe(true);
    expect(success).toHaveBeenCalledWith({ labels: ['poslední'] }, form);
  });

  test('leaving the field keeps the typed text, it becomes a tag only when the form is sent', async () => {
    const { form, control, input } = setupLabels();
    type(input, 'rozepsaný');
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    expect(control.getValue()).toEqual([]);
    expect(input.value).toBe('rozepsaný');
    expect(await form.submit()).toBe(true);
    expect(control.getValue()).toEqual(['rozepsaný']);
  });

  test('Enter never sends the form, Escape in a closed list is left to a dialog', () => {
    const { form, input } = setupLabels();
    const success = vi.fn();
    form.onSuccess = success;
    expect(key(input, 'Enter')).toBe(false);
    expect(success).not.toHaveBeenCalled();
    const outside = vi.fn();
    document.body.addEventListener('keydown', outside);
    type(input, 'b');
    key(input, 'Escape');
    expect(outside).not.toHaveBeenCalled();
    key(input, 'Escape');
    expect(outside).toHaveBeenCalledTimes(1);
    document.body.removeEventListener('keydown', outside);
  });

  test('types: a list field, allowNew only for lists of texts', () => {
    const form = new Form<Article & { title: string }>();
    // @ts-expect-error a tag input needs a list
    void (() => form.addTagInput('title'));
    // @ts-expect-error categories are numbers, a typed text cannot be one
    void (() => form.addTagInput('categories', '', { allowNew: true }));
    const control: TagInput<string> = form.addTagInput('labels', '', { allowNew: true });
    void control;
  });

  test('Bootstrap: the classes of THEME_BOOTSTRAP from phloxcz/forms-taginput', async () => {
    const form = new Form<Article>();
    const control = form.addTagInput('labels', 'Štítky:', { items: [['bio', 'bio']], allowNew: true });
    class Page extends Presenter {
      render() { return <FormView form={form} />; }
    }
    const { element } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    control.setValue(['bio']);
    const input = element.querySelector<HTMLInputElement>('input[role=combobox]')!;
    expect(element.querySelector('[data-phlox-taginput-container]')!.className).toContain('form-control');
    expect(element.querySelector('[data-phlox-taginput-tag]')!.className).toContain('badge text-bg-primary');
    const remove = element.querySelector('[data-phlox-taginput-remove]')!;
    expect(remove.className).toContain('btn-close');
    expect(remove.textContent).toBe('');
    type(input, 'x');
    expect(element.querySelector('[data-phlox-taginput-dropdown]')!.className).toBe('phlox-taginput__dropdown dropdown-menu show');
    expect(element.querySelector('[role=option]')!.className).toContain('dropdown-item text-success');
  });
});
