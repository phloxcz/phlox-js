import { describe, expect, test } from 'vitest';
import { Component, Presenter, RouteFrame, messageTexts, state } from '../src/index';
import type { Route } from '../src/index';
import { Form } from '../src/forms/index';
import { boot, tick, until } from './helpers';

const unsaved = state(false);

/** The topmost open dialog and its button. */
const top = () => [...document.querySelectorAll('dialog')].at(-1) ?? null;
const press = (text: string) => [...top()!.querySelectorAll('button')].find(button => button.textContent === text)!.click();
const asking = () => top()?.textContent?.includes(messageTexts.unsaved) ?? false;

class Field extends Component {
  override hasUnsavedChanges() { return unsaved(); }
  render() { return <input />; }
}

class Edit extends Presenter {
  render() { return <section><h1>edit</h1><Field /></section>; }
}

class Other extends Presenter {
  render() { return <h1>other</h1>; }
}

class Note extends Component<{}, string> {
  static last: Note | null = null;
  override startup() { Note.last = this; }
  override hasUnsavedChanges() { return unsaved(); }
  override title() { return 'Poznámka'; }
  render() { return <textarea />; }
}

class App extends Presenter {
  override routes: Route[] = [
    { name: 'edit', pattern: '/edit', presenter: Edit },
    { name: 'other', pattern: '/other', presenter: Other },
    { name: 'note', pattern: '/note', dialog: () => [Note, {}] },
    { name: 'home', pattern: '/' },
  ];
  render() { return <main><RouteFrame /></main>; }
}

const heading = (element: Element) => element.querySelector('h1')?.textContent ?? null;

describe('leaving with unsaved changes', () => {
  test('a link asks; Cancel stays on the page, Leave goes on', async () => {
    unsaved.set(true);
    const { app, element, go } = await boot(App, '/edit');
    const left = go('/other');
    await until(asking);
    expect(heading(element)).toBe('edit');
    press(messageTexts.cancel);
    await left;
    expect(heading(element)).toBe('edit');
    expect(location.pathname).toBe('/edit');
    expect(app.presenter!.route()).toBe('edit');

    const again = go('/other');
    await until(asking);
    press(messageTexts.leave);
    await again;
    expect(heading(element)).toBe('other');
    expect(location.pathname).toBe('/other');
    unsaved.set(false);
  });

  test('without changes nobody asks, a component that stays is not asked about', async () => {
    unsaved.set(false);
    const { element, go } = await boot(App, '/edit');
    await go('/other');
    expect(heading(element)).toBe('other');
    expect(top()).toBeNull();
  });

  test('Back asks and returns the URL when the user stays', async () => {
    unsaved.set(false);
    const { element, go } = await boot(App, '/other');
    await go('/edit');
    unsaved.set(true);
    history.back();
    await until(asking);
    press(messageTexts.cancel);
    await until(() => location.pathname === '/edit');
    await tick();
    expect(location.pathname).toBe('/edit');
    expect(heading(element)).toBe('edit');

    history.back();
    await until(asking);
    press(messageTexts.leave);
    await until(() => heading(element) === 'other');
    expect(location.pathname).toBe('/other');
    unsaved.set(false);
  });

  test('a dialog: Escape and × ask, close() from code does not', async () => {
    unsaved.set(true);
    const { app } = await boot(App);
    const result = app.presenter!.openDialog(Note, {});
    await tick();
    const note = top()!;
    note.dispatchEvent(new Event('cancel', { cancelable: true }));
    await until(asking);
    press(messageTexts.cancel);
    await tick();
    expect(top()).toBe(note);

    note.querySelector<HTMLButtonElement>('header button')!.click();
    await until(asking);
    press(messageTexts.leave);
    expect(await result).toBeUndefined();
    expect(top()).toBeNull();

    // Saved by its own button: closed on purpose, with the changes still there
    const saved = app.presenter!.openDialog(Note, {});
    await tick();
    Note.last!.close('uloženo');
    expect(await saved).toBe('uloženo');
    expect(top()).toBeNull();
    unsaved.set(false);
  });

  test('a routed dialog closed by its code leaves without a question', async () => {
    unsaved.set(true);
    const { element } = await boot(App, '/note');
    await tick();
    expect(top()!.textContent).toContain('Poznámka');
    // Escape asks, then Leave goes back to the presenter's URL
    top()!.dispatchEvent(new Event('cancel', { cancelable: true }));
    await until(asking);
    press(messageTexts.leave);
    await until(() => location.pathname === '/');
    await tick();
    expect(top()).toBeNull();
    expect(element.querySelector('textarea')).toBeNull();
    unsaved.set(false);
  });

  test('closing the page: the browser asks only with unsaved changes', async () => {
    unsaved.set(false);
    await boot(App, '/edit');
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);
    unsaved.set(true);
    expect(unload()).toBe(true);
    unsaved.set(false);
  });
});

describe('Form.isChanged', () => {
  const make = () => {
    const form = new Form<{ name: string; tags: string[] }>();
    form.addText('name');
    form.addTagInput('tags');
    return form;
  };

  test('against the defaults, the submit and reset', async () => {
    const form = make();
    expect(form.isChanged()).toBe(false);
    form.setDefaults({ name: 'Mléko', tags: ['a'] });
    expect(form.isChanged()).toBe(false);
    form.setValues({ name: 'Máslo' });
    expect(form.isChanged()).toBe(true);
    form.setValues({ name: 'Mléko' });
    expect(form.isChanged()).toBe(false);
    form.setValues({ tags: ['a', 'b'] });
    expect(form.isChanged()).toBe(true);

    form.onSuccess = () => {};
    expect(await form.submit()).toBe(true);
    expect(form.isChanged()).toBe(false);
    form.reset();
    expect(form.isChanged()).toBe(false);
  });

  test('a failed submit keeps the changes', async () => {
    const form = make();
    form.setDefaults({ name: 'a' });
    form.setValues({ name: 'b' });
    form.onSuccess = () => { throw new Error('server'); };
    await expect(form.submit()).rejects.toThrow('server');
    expect(form.isChanged()).toBe(true);
  });
});
