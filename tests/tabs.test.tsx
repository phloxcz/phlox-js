import { afterEach, describe, expect, test, vi } from 'vitest';
import { Presenter, Tab, Tabs, render, state } from '../src/index';
import type { Child } from '../src/index';
import { Form, FormTag, Input } from '../src/forms/index';
import { fitTabs } from '../src/ui/tabs';
import { boot, tick } from './helpers';

function mount(view: () => Child) {
  const root = document.createElement('div');
  document.body.append(root);
  render(view, root);
  return root;
}

const tabs = (root: ParentNode) => [...root.querySelectorAll<HTMLButtonElement>('[role=tab]')];
const panels = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>('[role=tabpanel]')];
const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fitTabs', () => {
  test('all fit; otherwise as many from the start as fit next to "More", the chosen one always', () => {
    expect(fitTabs([100, 100, 100], 300, 80, 0)).toEqual([true, true, true]);
    expect(fitTabs([100, 100, 100, 100], 350, 80, 0)).toEqual([true, true, false, false]);
    // The chosen tab takes the place of the last one that fits
    expect(fitTabs([100, 100, 100, 100], 350, 80, 3)).toEqual([true, false, false, true]);
    // Not even one more fits: the chosen one alone
    expect(fitTabs([300, 100], 200, 80, 1)).toEqual([false, true]);
  });
});

describe('Tabs', () => {
  test('the tab chooses its panel, the others stay in the page hidden; arrows, Home and End', () => {
    const selected = state(0);
    const root = mount(() => (
      <Tabs selected={selected} aria-label="Produkt">
        <Tab title="Název a popis"><p>Popis</p></Tab>
        <Tab title={<><b>Varianty</b></>}><p>Varianty</p></Tab>
        <Tab title="Parametry"><p>Parametry</p></Tab>
      </Tabs>
    ));
    expect(root.querySelector('[role=tablist]')!.getAttribute('aria-label')).toBe('Produkt');
    expect(tabs(root).map(tab => tab.textContent)).toEqual(['Název a popis', 'Varianty', 'Parametry']);
    expect(tabs(root).map(tab => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(panels(root).map(panel => panel.hidden)).toEqual([false, true, true]);
    expect(panels(root)[1]!.getAttribute('aria-labelledby')).toBe(tabs(root)[1]!.id);
    expect(tabs(root).map(tab => tab.tabIndex)).toEqual([0, -1, -1]);

    tabs(root)[1]!.click();
    expect(selected()).toBe(1);
    expect(panels(root).map(panel => panel.hidden)).toEqual([true, false, true]);

    key(tabs(root)[1]!, 'ArrowRight');
    expect(selected()).toBe(2);
    expect(document.activeElement).toBe(tabs(root)[2]);
    key(tabs(root)[2]!, 'ArrowRight');
    expect(selected()).toBe(0);
    key(tabs(root)[0]!, 'End');
    expect(selected()).toBe(2);
    key(tabs(root)[2]!, 'Home');
    expect(selected()).toBe(0);
    selected.set(2);
    expect(tabs(root)[2]!.getAttribute('aria-selected')).toBe('true');
  });

  test('a title with an image or an SVG icon, in the tab and in the menu "More" too', async () => {
    let resized = (): void => {};
    vi.stubGlobal('ResizeObserver', class {
      public constructor(callback: () => void) { resized = callback; }
      public observe() {}
      public disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { width: this.getAttribute('role') === 'tab' ? 100 : 80 } as DOMRect;
    });
    const icon = () => <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 2h12v12H2z" /></svg>;
    class Page extends Presenter {
      public render() {
        return (
          <Tabs>
            <Tab title="Název"><p>Název</p></Tab>
            <Tab title={<><img src="/flag-cz.png" alt="" /> Česky</>}><p>Česky</p></Tab>
            <Tab title={<>{icon()} Parametry</>}><p>Parametry</p></Tab>
          </Tabs>
        );
      }
    }
    const { element } = await boot(Page);
    const [, czech, params] = tabs(element);
    expect(czech!.querySelector('img')!.getAttribute('src')).toBe('/flag-cz.png');
    expect(czech!.textContent).toBe(' Česky');
    expect(params!.querySelector('svg')!.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(params!.querySelector('path')!.namespaceURI).toBe('http://www.w3.org/2000/svg');

    // Only the first one fits: both titles with pictures go to the menu, as new copies
    Object.defineProperty(element.querySelector('.phlox-tabs-nav')!, 'clientWidth', { value: 200 });
    resized();
    element.querySelector<HTMLElement>('.phlox-tabs-more button')!.click();
    const items = [...document.querySelectorAll<HTMLButtonElement>('.phlox-dropdown-item')];
    expect(items[0]!.querySelector('img')!.getAttribute('src')).toBe('/flag-cz.png');
    expect(items[1]!.querySelector('path')!.namespaceURI).toBe('http://www.w3.org/2000/svg');
    // The tabs keep theirs
    expect(params!.querySelector('svg')).not.toBeNull();
  });

  test('only <Tab> inside', () => {
    expect(() => mount(() => <Tabs><p>Ne</p></Tabs>)).toThrow('<Tabs> may contain only <Tab> elements.');
  });

  test('a failed validation opens the tab of the first error, its tab has a mark', async () => {
    const form = new Form<{ name: string; code: string }>();
    form.addText('name', 'Název');
    form.addText('code', 'Kód').setRequired('Vyplňte kód.');
    form.setDefaults({ name: 'Káva', code: '' });
    const selected = state(0);
    const root = mount(() => (
      <FormTag form={form}>
        <Tabs selected={selected}>
          <Tab title="Název"><Input control={form.get('name')} /></Tab>
          <Tab title="Systémové"><Input control={form.get('code')} /></Tab>
        </Tabs>
      </FormTag>
    ));
    expect(await form.submit()).toBe(false);
    expect(selected()).toBe(1);
    expect(document.activeElement).toBe(root.querySelector('[name=code]'));
    await tick();
    expect(tabs(root)[1]!.querySelector('.phlox-tab-error')!.textContent).toBe('contains an error');
    expect(tabs(root)[0]!.querySelector('.phlox-tab-error')).toBeNull();

    form.get('code').setValue('A1');
    expect(form.validate()).toBe(true);
    await tick();
    expect(tabs(root)[1]!.querySelector('.phlox-tab-error')).toBeNull();
  });

  test('tabs that do not fit go behind "More", choosing one from there shows it', async () => {
    let resized = (): void => {};
    vi.stubGlobal('ResizeObserver', class {
      public constructor(callback: () => void) { resized = callback; }
      public observe() {}
      public disconnect() {}
    });
    // Each tab 100 px, "More" 80 px, the row 350 px: two tabs fit next to "More"
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { width: this.getAttribute('role') === 'tab' ? 100 : 80 } as DOMRect;
    });
    class Page extends Presenter {
      public render() {
        return (
          <Tabs>
            {['Název', 'Varianty', 'Ceny', 'Zařazení', 'Parametry'].map(title => <Tab title={title}><p>{title}</p></Tab>)}
          </Tabs>
        );
      }
    }
    const { element } = await boot(Page);
    const nav = element.querySelector<HTMLElement>('.phlox-tabs-nav')!;
    Object.defineProperty(nav, 'clientWidth', { value: 350 });
    resized();
    expect(tabs(element).map(tab => tab.hidden)).toEqual([false, false, true, true, true]);
    const more = element.querySelector<HTMLElement>('.phlox-tabs-more')!;
    expect(more.hidden).toBe(false);

    more.querySelector('button')!.click();
    const items = [...document.querySelectorAll<HTMLButtonElement>('.phlox-dropdown-item')];
    expect(items.map(item => item.textContent)).toEqual(['Ceny', 'Zařazení', 'Parametry']);
    items[2]!.click();
    await tick();
    expect(tabs(element)[4]!.getAttribute('aria-selected')).toBe('true');
    expect(tabs(element).map(tab => tab.hidden)).toEqual([false, true, true, true, false]);
    expect(panels(element)[4]!.hidden).toBe(false);
  });
});
