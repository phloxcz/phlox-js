/**
 * The site of the documentation (examples/docs): every page is in the menu, every demo it shows exists,
 * and every demo renders without an error. A demo that is a presenter runs as an application.
 */
import { describe, expect, test } from 'vitest';
import { Container, Presenter, Theme, h } from '../src/index';
import { bootApp } from '../src/testing/index';
import { CONTENTS } from '../examples/docs/contents';
import { isPresenter } from '../examples/docs/page';
import type { DemoModule } from '../examples/docs/page';
import { tick, until } from './helpers';

const PAGES = import.meta.glob<string>('../examples/docs/*/*.md', { query: '?raw', import: 'default', eager: true });
// Files starting with _ are parts of demos (a lazily loaded presenter…), not demos
const DEMOS = import.meta.glob<DemoModule>(['../examples/docs/*/*.tsx', '!../examples/docs/*/_*.tsx']);
const name = (file: string) => file.replace('../examples/docs/', '').replace(/\.(md|tsx)$/, '');

describe('documentation', () => {
  test('every page is in the menu and every page of the menu exists', () => {
    const inMenu = CONTENTS.flatMap(section => section.pages.map(page => `${section.path}/${page.path}`)).sort();
    expect(Object.keys(PAGES).map(name).sort()).toEqual(inMenu);
  });

  test('every demo shown on a page exists, every demo is shown', () => {
    const shown = Object.entries(PAGES).flatMap(([file, text]) => {
      const folder = name(file).split('/')[0];
      return [...text.matchAll(/<!--\s*demo:\s*([\w-]+)\s*-->/g)].map(match => `${folder}/${match[1]}`);
    });
    expect(shown.filter(demo => !DEMOS[`../examples/docs/${demo}.tsx`])).toEqual([]);
    expect(Object.keys(DEMOS).map(name).filter(demo => !shown.includes(demo))).toEqual([]);
  });

  for (const [file, load] of Object.entries(DEMOS)) {
    test(`the demo ${name(file)} renders`, async () => {
      const module = await load();
      const services = new Container().add(new Theme());
      module.services?.(services);
      const View = module.default;
      const root = isPresenter(View) ? View : class extends Presenter {
        public render() {
          return h(View as never, {});
        }
      };
      const { element, errors } = await bootApp(root, { url: '/', services });
      // A demo with async startup() shows once its data are there
      await until(() => element.textContent!.trim().length + element.querySelectorAll('input, select, svg').length > 0);
      await tick();
      expect(errors).toEqual([]);
    });
  }
});
