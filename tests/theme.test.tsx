import { describe, expect, test } from 'vitest';
import { BootstrapTheme, Component, Container, Presenter, Theme, render } from '../src/index';
import { Form, FormTag, FormView, Input } from '../src/forms/index';
import { boot, tick } from './helpers';

function formWithEveryKind() {
  const form = new Form<{ name: string; note: string; done: boolean; size: number; tags: string[]; kind: string }>();
  form.addText('name', 'Name:').setRequired('Required.');
  form.addTextArea('note', 'Note:');
  form.addCheckbox('done', 'Done');
  form.addSelect('size', 'Size:', [[1, 'S'], [2, 'M']]);
  form.addCheckboxList('tags', 'Tags:', [['a', 'A']]);
  form.addRadioList('kind', 'Kind:', [['x', 'X']]);
  form.addSubmit('save', 'Save');
  return form;
}

describe('themes', () => {
  test('without a theme in the container the default one is used', async () => {
    const form = formWithEveryKind();
    class Page extends Presenter {
      render() { return <FormView form={form} />; }
    }
    const { element, app } = await boot(Page);
    expect(app.theme).toBeInstanceOf(Theme);
    expect(element.querySelector('form')!.className).toBe('phlox-form');
    expect(element.querySelector('input[name=name]')!.className).toBe('phlox-input');
    expect(element.querySelector('.phlox-form-row')).not.toBeNull();
  });

  test('Bootstrap: forms get Bootstrap classes, an invalid control gets is-invalid', async () => {
    const form = formWithEveryKind();
    class Page extends Presenter {
      render() { return <FormView form={form} />; }
    }
    const { element } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    const name = element.querySelector('input[name=name]')!;
    expect(element.querySelector('form')!.className).toBe('');
    expect(name.className).toBe('form-control');
    expect(element.querySelector(`label[for="${name.id}"]`)!.className).toBe('form-label required');
    expect(element.querySelector('textarea')!.className).toBe('form-control');
    expect(element.querySelector('select')!.className).toBe('form-select');
    expect(element.querySelector('input[name=done]')!.className).toBe('form-check-input');
    expect(element.querySelector('input[name=done]')!.parentElement!.className).toBe('form-check');
    expect(element.querySelector('input[name=tags]')!.parentElement!.className).toBe('form-check');
    expect(element.querySelector('input[name=kind]')!.className).toBe('form-check-input');
    expect(element.querySelector('button')!.className).toBe('btn btn-primary');
    expect(element.querySelectorAll('.mb-3').length).toBeGreaterThan(0);

    expect(await form.submit()).toBe(false);
    expect(name.className).toBe('form-control is-invalid');
    expect(element.querySelector('.invalid-feedback')!.textContent).toBe('Required.');
    form.addError('From the server.');
    expect(element.querySelector('.alert.alert-danger')!.textContent).toBe('From the server.');
  });

  test('a class passed to <Input> is added, on a button it replaces the one of the theme', async () => {
    const form = formWithEveryKind();
    const cancel = form.addSubmit('cancel', 'Cancel');
    class Page extends Presenter {
      render() {
        return (
          <FormTag form={form}>
            <Input control={form.get('name')} class="wide" />
            <Input control={cancel} class="btn btn-secondary" />
            <Input control={form.getButton('save')} />
          </FormTag>
        );
      }
    }
    const { element } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    expect(element.querySelector('input[name=name]')!.className).toBe('form-control wide');
    expect(element.querySelector('button[name=cancel]')!.className).toBe('btn btn-secondary');
    expect(element.querySelector('button[name=save]')!.className).toBe('btn btn-primary');
  });

  test('Bootstrap: dialogs get self-contained utility classes and an icon close button', async () => {
    class Hello extends Component {
      override title() { return 'Hello'; }
      override actions() { return <button>OK</button>; }
      render() { return <p>body</p>; }
    }
    class Page extends Presenter {
      render() { return <b />; }
    }
    const { app } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    void app.presenter!.openDialog(Hello, {});
    await tick();
    const dialog = document.querySelector('dialog')!;
    expect(dialog.className).toBe('phlox-dialog border-0 p-0 bg-transparent');
    const content = dialog.firstElementChild!;
    expect(content.className).toBe('bg-body text-body border rounded-3 shadow');
    expect(content.querySelector('header.border-bottom > h2.h5')!.textContent).toBe('Hello');
    expect(content.querySelector('header .btn-close')!.textContent).toBe('');
    expect(content.querySelector('.p-3')!.textContent).toBe('body');
    expect(content.querySelector('footer.border-top')!.textContent).toBe('OK');
    // modal-* would need the variables of a .modal wrapper, which a native <dialog> does not have
    expect(dialog.querySelector('[class*="modal-"]')).toBeNull();
  });

  test('single slots can be changed, own controls can use own slots', async () => {
    const theme = new BootstrapTheme({ formRow: 'row mb-2', 'dropdownlist.wrapper': 'dropdown' });
    expect(theme.class('formRow')).toBe('row mb-2');
    expect(theme.class('input')).toBe('form-control');
    expect(theme.class('dropdownlist.wrapper')).toBe('dropdown');
    expect(theme.class('nothing.here')).toBe('');
  });

  test('another CSS framework is another map of classes', async () => {
    class FoundationTheme extends Theme {
      constructor() {
        super({ input: 'input-foundation', error: 'form-error is-visible', invalid: 'is-invalid-input' });
      }
    }
    const form = formWithEveryKind();
    class Page extends Presenter {
      render() { return <FormView form={form} />; }
    }
    const { element } = await boot(Page, '/', new Container().add(new FoundationTheme()));
    await form.submit();
    expect(element.querySelector('input[name=name]')!.className).toBe('input-foundation is-invalid-input');
    expect(element.querySelector('.form-error.is-visible')!.textContent).toBe('Required.');
  });

  test('outside an application the default theme is used', () => {
    const form = formWithEveryKind();
    const root = document.createElement('div');
    render(() => <FormView form={form} />, root);
    expect(root.querySelector('input[name=name]')!.className).toBe('phlox-input');
  });
});
