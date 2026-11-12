import { describe, expect, test, vi } from 'vitest';
import { BootstrapTheme, Container, FlashMessages, Presenter, messageTexts } from '../src/index';
import { Grid, GridView } from '../src/components/index';
import { boot, tick } from './helpers';

class Page extends Presenter {
  render() { return <button id="anchor">Smazat</button>; }
}

const toasts = () => [...document.querySelectorAll<HTMLElement>('.cap-notify')];
const dialog = () => document.querySelector<HTMLDialogElement>('dialog')!;
const button = (root: ParentNode, text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text)!;

describe('toasts', () => {
  test('flash messages are toasts: type, title, closing, the corner', async () => {
    // The corner is set before the application starts
    const flashes = new FlashMessages();
    flashes.position = 'bottom-left';
    const { app } = await boot(Page, '/', new Container().add(flashes));
    app.presenter!.flashMessage('Uloženo.', 'success', { title: 'Hotovo' });
    app.presenter!.flashMessage('Nepovedlo se.', 'error');
    await tick();
    const [saved, failed] = toasts();
    expect(saved!.dataset.type).toBe('success');
    expect(saved!.getAttribute('role')).toBe('status');
    expect(saved!.querySelector('.cap-notify-title')!.textContent).toBe('Hotovo');
    expect(saved!.querySelector('.cap-notify-msg')!.textContent).toBe('Uloženo.');
    expect(saved!.querySelector('.cap-notify-progress')!.getAttribute('style')).toBe('animation-duration: 5000ms');
    // Errors stay and are announced at once
    expect(failed!.getAttribute('role')).toBe('alert');
    expect(failed!.querySelector('.cap-notify-progress')).toBeNull();
    expect(document.querySelector('.cap-notify-container')!.getAttribute('data-pos')).toBe('bottom-left');

    failed!.querySelector<HTMLButtonElement>('.cap-notify-close')!.click();
    await tick();
    expect(app.flashes.messages().map(flash => flash.text)).toEqual(['Uloženo.']);
  });

  test('a toast disappears by itself, but not while the pointer is on it', () => {
    vi.useFakeTimers();
    try {
      const flashes = new FlashMessages();
      const flash = flashes.add('Uloženo.');
      vi.advanceTimersByTime(3000);
      flashes.pause(flash);
      vi.advanceTimersByTime(10_000);
      expect(flashes.messages()).toHaveLength(1);
      flashes.resume(flash);
      vi.advanceTimersByTime(1999);
      expect(flashes.messages()).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(flashes.messages()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  test('a layout that shows the messages itself turns the toasts off', async () => {
    const flashes = new FlashMessages();
    flashes.toasts = false;
    const { app } = await boot(Page, '/', new Container().add(flashes));
    app.presenter!.flashMessage('Uloženo.');
    await tick();
    expect(toasts()).toHaveLength(0);
    expect(app.flashes.messages()).toHaveLength(1);
  });

  test('Bootstrap: alerts', async () => {
    const { app } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    app.presenter!.flashMessage('Pozor.', 'warning');
    await tick();
    expect(toasts()[0]!.className).toBe('cap-notify alert alert-dismissible shadow-sm mb-0 alert-warning');
    expect(toasts()[0]!.querySelector('button')!.className).toBe('cap-notify-close btn-close');
  });
});

describe('alert, confirm and prompt in a dialog', () => {
  test('confirm: OK is true, Escape is false', async () => {
    const { app } = await boot(Page);
    const asked = app.presenter!.confirm('Smazat položku?', { title: 'Mazání', danger: true });
    await tick();
    expect(dialog().textContent).toContain('Smazat položku?');
    expect(dialog().querySelector('h2')!.textContent).toBe('Mazání');
    expect(button(dialog(), 'OK').className).toBe('phlox-button phlox-button-danger');
    // Dangerous: Enter would press Cancel
    expect(button(dialog(), messageTexts.cancel).hasAttribute('autofocus')).toBe(true);
    expect(button(dialog(), 'OK').hasAttribute('autofocus')).toBe(false);
    button(dialog(), 'OK').click();
    expect(await asked).toBe(true);
    expect(document.querySelector('dialog')).toBeNull();

    const again = app.presenter!.confirm('Smazat?');
    await tick();
    expect(button(dialog(), 'OK').hasAttribute('autofocus')).toBe(true);
    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(await again).toBe(false);
  });

  test('prompt gives the text, alert just waits', async () => {
    const { app } = await boot(Page);
    const name = app.prompt('Název:', { value: 'Nákup', okText: 'Uložit' });
    await tick();
    const input = dialog().querySelector('input')!;
    expect(input.value).toBe('Nákup');
    input.value = 'Velký nákup';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(await name).toBe('Velký nákup');

    const cancelled = app.prompt('Název:');
    await tick();
    button(dialog(), messageTexts.cancel).click();
    expect(await cancelled).toBeNull();

    const info = app.alert('Hotovo.');
    await tick();
    expect(button(dialog(), messageTexts.cancel)).toBeUndefined();
    button(dialog(), 'OK').click();
    expect(await info).toBeUndefined();
  });

  test('loading: no buttons, Escape does not close it, the code does', async () => {
    const { app } = await boot(Page);
    const loading = app.presenter!.loading('Ukládám…');
    const element = dialog();
    expect(element.querySelector('[role=status]')!.textContent).toBe('Ukládám…');
    expect(element.querySelectorAll('button')).toHaveLength(0);
    element.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(document.querySelector('dialog')).toBe(element);
    loading.update('Ukládám 2 z 5…');
    expect(element.querySelector('[role=status]')!.textContent).toBe('Ukládám 2 z 5…');
    loading.close();
    expect(document.querySelector('dialog')).toBeNull();
  });
});

describe('the popover', () => {
  test('at an element: the focus on Cancel when dangerous, Escape cancels and goes back, a click outside cancels', async () => {
    const { app, element } = await boot(Page);
    const anchor = element.querySelector<HTMLButtonElement>('#anchor')!;
    const asked = app.presenter!.confirm('Smazat?', { anchor, danger: true });
    const popover = document.querySelector<HTMLElement>('.cap-popover')!;
    expect(popover.getAttribute('role')).toBe('alertdialog');
    expect(popover.style.position).toBe('fixed');
    expect(document.activeElement).toBe(button(popover, messageTexts.cancel));
    expect(button(popover, 'OK').className).toBe('cap-pop-btn cap-pop-btn-ok cap-pop-btn-danger');
    const outside = vi.fn();
    document.addEventListener('keydown', outside);
    popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    document.removeEventListener('keydown', outside);
    expect(await asked).toBe(false);
    expect(outside).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(anchor);
    expect(document.querySelector('.cap-popover')).toBeNull();

    const clicked = app.presenter!.confirm('Smazat?', { anchor });
    expect(document.activeElement).toBe(button(document.querySelector('.cap-popover')!, 'OK'));
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(await clicked).toBe(false);

    const named = app.presenter!.prompt('Nový název', { anchor, value: 'a' });
    const input = document.querySelector<HTMLInputElement>('.cap-popover input')!;
    expect(document.activeElement).toBe(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(await named).toBe('a');
  });

  test('Bootstrap: its popover with the side and the arrow', async () => {
    const { app, element } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    const asked = app.presenter!.confirm('Smazat?', { anchor: element.querySelector('#anchor') });
    const popover = document.querySelector<HTMLElement>('.popover')!;
    expect(popover.className).toBe('popover cap-popover-bs bs-popover-bottom');
    expect(popover.querySelector('.popover-arrow')).not.toBeNull();
    expect(button(popover, 'OK').className).toBe('btn btn-sm btn-primary');
    button(popover, 'OK').click();
    expect(await asked).toBe(true);
  });
});

test('the grid asks by a popover at the button of the action', async () => {
  const rows = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
  const grid = new Grid<{ id: number; name: string }>({ rows: () => rows });
  grid.addTextColumn('name', 'Název');
  grid.addAction('Smazat', { onClick: row => void rows.splice(rows.indexOf(row), 1), confirm: row => `Smazat ${row.name}?`, primary: true, danger: true });
  class Orders extends Presenter {
    render() { return <GridView grid={grid} />; }
  }
  const { element } = await boot(Orders);
  await tick();
  const remove = element.querySelector<HTMLButtonElement>('tbody tr .phx-grid-actions button')!;
  remove.click();
  await tick();
  const popover = document.querySelector<HTMLElement>('.cap-popover')!;
  expect(popover.textContent).toContain('Smazat A?');
  button(popover, 'OK').click();
  await tick();
  await tick();
  expect(rows.map(row => row.name)).toEqual(['B']);
  expect([...element.querySelectorAll('tbody td[data-col-key="name"]')].map(cell => cell.textContent)).toEqual(['B']);
});
