import { expect, test, vi } from 'vitest';
import { BootstrapTheme, Button, Container, Presenter, state } from '../src/index';
import { boot } from './helpers';

const busy = state(false);
const clicked = vi.fn();

class Page extends Presenter {
  render() {
    return (
      <p>
        <Button onClick={clicked}>Zrušit</Button>
        <Button primary disabled={busy}>Uložit</Button>
        <Button danger small class="ms-auto" aria-label="Smazat položku">Smazat</Button>
        <Button primary type="submit">Odeslat</Button>
      </p>
    );
  }
}

const buttons = (element: Element) => [...element.querySelectorAll('button')];

test('the default theme: variants, size, own classes and attributes', async () => {
  const { element } = await boot(Page);
  const [cancel, save, remove, submit] = buttons(element);
  expect(cancel!.className).toBe('phlox-button');
  expect(cancel!.type).toBe('button');
  expect(save!.className).toBe('phlox-button phlox-button-primary');
  expect(remove!.className).toBe('phlox-button phlox-button-danger phlox-button-small ms-auto');
  expect(remove!.getAttribute('aria-label')).toBe('Smazat položku');
  expect(submit!.type).toBe('submit');

  cancel!.click();
  expect(clicked).toHaveBeenCalledOnce();
  expect(save!.disabled).toBe(false);
  busy.set(true);
  expect(save!.disabled).toBe(true);
  busy.set(false);
});

test('Bootstrap', async () => {
  const { element } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
  expect(buttons(element).map(button => button.className)).toEqual([
    'btn btn-outline-secondary',
    'btn btn-primary',
    'btn btn-danger btn-sm ms-auto',
    'btn btn-primary',
  ]);
});
