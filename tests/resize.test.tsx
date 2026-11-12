import { afterEach, describe, expect, test } from 'vitest';
import { BrowserPreferences, Container, Preferences, Presenter, ResizeHandle } from '../src/index';
import { boot } from './helpers';

afterEach(() => localStorage.clear());

describe('preferences', () => {
  test('a state that starts with the remembered value and remembers every change', async () => {
    localStorage.setItem('phlox.tasks.width', '500');
    let page!: Page;
    class Page extends Presenter {
      width = this.preference('tasks.width', 416);
      collapsed = this.preference('nav.collapsed', false);
      render() { return <main />; }
    }
    const { app } = await boot(Page);
    page = app.presenter as Page;
    expect(page.width()).toBe(500);
    expect(page.collapsed()).toBe(false);
    page.collapsed.set(true);
    page.width.update(width => width + 10);
    expect(localStorage.getItem('phlox.nav.collapsed')).toBe('true');
    expect(localStorage.getItem('phlox.tasks.width')).toBe('510');
  });

  test('another storage by registering the service, a broken value is forgotten', async () => {
    const saved = new Map<string, unknown>();
    class ServerPreferences extends Preferences {
      get<T>(key: string) { return saved.get(key) as T | undefined; }
      set(key: string, value: unknown) { saved.set(key, value); }
    }
    class Page extends Presenter {
      width = this.preference('w', 1);
      render() { return <main />; }
    }
    const { app } = await boot(Page, '/', new Container().add(new ServerPreferences()));
    (app.presenter as Page).width.set(7);
    expect(saved.get('w')).toBe(7);

    localStorage.setItem('x.broken', '{nope');
    expect(new BrowserPreferences('x.').get('broken')).toBeUndefined();
  });
});

describe('ResizeHandle', () => {
  class Page extends Presenter {
    width = this.preference('col', 300);
    render() {
      return (
        <section id="col" style={() => ({ width: `${this.width()}px` })}>
          <ResizeHandle size={this.width} min={200} max={500} initial={300} label="Šířka" />
        </section>
      );
    }
  }
  const pointer = (type: string, x: number) => new PointerEvent(type, { clientX: x, button: 0, pointerId: 1, bubbles: true });

  test('dragging changes the width within the limits, Escape returns it, a double click resets it', async () => {
    const { app, element } = await boot(Page);
    const page = app.presenter as Page;
    const handle = element.querySelector<HTMLElement>('[role=separator]')!;
    expect(handle.getAttribute('aria-label')).toBe('Šířka');
    expect(handle.getAttribute('aria-valuenow')).toBe('300');

    handle.dispatchEvent(pointer('pointerdown', 100));
    window.dispatchEvent(pointer('pointermove', 150));
    expect(page.width()).toBe(350);
    expect(element.querySelector<HTMLElement>('#col')!.style.width).toBe('350px');
    window.dispatchEvent(pointer('pointermove', 900));
    expect(page.width()).toBe(500);
    window.dispatchEvent(pointer('pointerup', 900));
    expect(localStorage.getItem('phlox.col')).toBe('500');

    handle.dispatchEvent(pointer('pointerdown', 100));
    window.dispatchEvent(pointer('pointermove', -400));
    expect(page.width()).toBe(200);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(page.width()).toBe(500);
    // Ended: moving does nothing more
    window.dispatchEvent(pointer('pointermove', 0));
    expect(page.width()).toBe(500);

    handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(page.width()).toBe(300);
  });

  test('the keyboard: arrows by 16 px, with Shift by 64, Home and End to the limits', async () => {
    const { app, element } = await boot(Page);
    const page = app.presenter as Page;
    const handle = element.querySelector<HTMLElement>('[role=separator]')!;
    const press = (key: string, shiftKey = false) => handle.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
    press('ArrowRight');
    expect(page.width()).toBe(316);
    press('ArrowLeft', true);
    expect(page.width()).toBe(252);
    press('End');
    expect(page.width()).toBe(500);
    press('Home');
    expect(page.width()).toBe(200);
  });
});
