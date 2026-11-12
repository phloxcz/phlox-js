/**
 * The examples run as one site: every example is a page under its own path (/grid/…),
 * and the menu at the top switches among them. The page of an example is loaded anew,
 * because every example has its own services, texts and styles.
 */

import './menu.css';

export interface Example {
  /** The base path of the example's application, see Application.basePath. */
  path: string;
  title: string;
  description: string;
}

export const EXAMPLES: Example[] = [
  {
    path: '/shopping-list',
    title: 'Nákupní seznam',
    description: 'Presentery, routy, formuláře a jejich prvky, dialogy, překlady a flash zprávy.',
  },
  {
    path: '/tree',
    title: 'Strom kategorií',
    description: 'Strom načítaný po úrovních, výběr podle URL, přetahování a výběr ze stromu ve formuláři.',
  },
  {
    path: '/grid',
    title: 'Grid objednávek',
    description: 'Řazení, hledání, filtry a stránky v URL, akce, souhrny, šířky a pořadí sloupců.',
  },
  {
    path: '/helpdesk',
    title: 'Helpdesk',
    description: 'Celá aplikace proti mock JSON-RPC serveru: přihlášení, vnořené presentery, data přes resource(), dropdowny, nahrávání souborů.',
  },
];

const link = (example: Example, current: boolean): HTMLAnchorElement => {
  const a = document.createElement('a');
  a.href = example.path;
  a.textContent = example.title;
  if (current) a.setAttribute('aria-current', 'page');
  return a;
};

/** The menu of examples at the top of the page. Returns the base path of the current example. */
export function showExampleMenu(): string {
  const current = EXAMPLES.find(example => location.pathname === example.path || location.pathname.startsWith(`${example.path}/`));
  const nav = document.createElement('nav');
  nav.className = 'examples-menu';
  nav.setAttribute('aria-label', 'Ukázky');
  const home = Object.assign(document.createElement('a'), { href: '/', textContent: 'PhloxJS' });
  home.className = 'examples-home';
  nav.append(home, ...EXAMPLES.map(example => link(example, example === current)));
  document.body.prepend(nav);
  return current?.path ?? '';
}

/** The list of examples with their descriptions, for the front page. */
export function showExampleList(element: Element): void {
  element.replaceChildren(...EXAMPLES.map(example => {
    const item = document.createElement('li');
    const text = Object.assign(document.createElement('p'), { textContent: example.description });
    item.append(link(example, false), text);
    return item;
  }));
}
