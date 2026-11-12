import { describe, expect, test } from 'vitest';
import { BootstrapTheme, Component, Container, Dropdown, Presenter, RouteFrame, onCleanup } from '../src/index';
import type { Route } from '../src/index';
import { boot, tick } from './helpers';

let disposed = 0;
function Content() {
  onCleanup(() => disposed++);
  return <><input id="field" /><a href="/other" id="link">Jinam</a><button type="button" id="action">Akce</button></>;
}

class Page extends Presenter {
  render() {
    return <main><Dropdown label="Menu" title="Uživatel" panelClass="own"><Content /></Dropdown><p id="outside">venku</p></main>;
  }
}

const trigger = () => document.querySelector<HTMLButtonElement>('button[aria-haspopup]')!;
const panel = () => document.querySelector<HTMLElement>('.phlox-dropdown');

describe('Dropdown', () => {
  test('opens at the button with its content created anew, the focus goes inside', async () => {
    disposed = 0;
    await boot(Page);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().getAttribute('aria-label')).toBe('Uživatel');
    expect(panel()).toBeNull();
    trigger().click();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(panel()!.className).toBe('phlox-dropdown own');
    expect(panel()!.style.position).toBe('fixed');
    expect(document.activeElement?.id).toBe('field');
    // A second click on the button closes it and cleans up the content
    trigger().click();
    expect(panel()).toBeNull();
    expect(disposed).toBe(1);
  });

  test('a link or a button inside, a click outside and Escape close it', async () => {
    await boot(Page);
    trigger().click();
    panel()!.querySelector<HTMLButtonElement>('#action')!.click();
    await tick();
    expect(panel()).toBeNull();

    trigger().click();
    document.getElementById('outside')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(panel()).toBeNull();

    trigger().click();
    panel()!.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  test('it closes with the component that shows it; Bootstrap has its dropdown-menu', async () => {
    const { app } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    trigger().click();
    expect(document.querySelector('.dropdown-menu.show')).not.toBeNull();
    app.stop();
    expect(document.querySelector('.dropdown-menu')).toBeNull();
  });
});

describe('Component.link', () => {
  test('a component makes links by its presenter, absolute or by the name of a route', async () => {
    class Card extends Component {
      render() { return <><a id="absolute" href={this.link('/about')}>O nás</a><a id="route" href={this.link('detail', { id: 7 })}>Detail</a></>; }
    }
    class Items extends Presenter {
      override routes: Route[] = [{ name: 'default', pattern: '/' }, { name: 'detail', pattern: '/<id>' }];
      render() { return <section><Card /></section>; }
    }
    class Root extends Presenter {
      override routes: Route[] = [{ name: 'items', pattern: '/items', presenter: Items }];
      render() { return <RouteFrame />; }
    }
    const { element } = await boot(Root, '/items');
    expect(element.querySelector('#absolute')!.getAttribute('href')).toBe('/about');
    expect(element.querySelector('#route')!.getAttribute('href')).toBe('/items/7');
  });
});

test('in a modal dialog the panel is inside the dialog, not under its backdrop', async () => {
  class Menu extends Component {
    render() { return <Dropdown label="Více"><button type="button">Smazat</button></Dropdown>; }
  }
  const { app } = await boot(Page);
  void app.presenter!.openDialog(Menu, {});
  await tick();
  const dialog = document.querySelector('dialog')!;
  dialog.querySelector<HTMLButtonElement>('button[aria-haspopup]')!.click();
  expect(dialog.querySelector('.phlox-dropdown')).not.toBeNull();
});
