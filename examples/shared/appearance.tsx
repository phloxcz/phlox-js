/**
 * The look of the examples, switched by the user: the theme (default or Bootstrap), light or dark mode,
 * and animations. The choice is remembered in the browser. ?theme=bootstrap or ?theme=default in the URL wins.
 */

import { For, motion, setMotion } from 'phlox-js';
import type { Child, Motion } from 'phlox-js';

export type Look = 'default' | 'bootstrap';
export type Scheme = 'system' | 'light' | 'dark';

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(`phlox-example-${key}`);
  } catch {
    return null;
  }
};
const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(`phlox-example-${key}`, value);
  } catch {
    // Not remembered, it applies until the page is closed
  }
};

/** The theme of this page load. Another theme needs other CSS, so it is changed by loading the page again. */
export const look: Look = (new URLSearchParams(location.search).get('theme') ?? read('theme')) === 'bootstrap' ? 'bootstrap' : 'default';
export const bootstrap = look === 'bootstrap';

const dark = window.matchMedia?.('(prefers-color-scheme: dark)');
let scheme: Scheme = (read('scheme') as Scheme | null) ?? 'system';

/**
 * Light or dark: color-scheme for the default theme, which uses the colours of the system,
 * and data-bs-theme for Bootstrap, which has its own colours for both.
 */
function applyScheme(): void {
  const root = document.documentElement;
  root.style.colorScheme = scheme === 'system' ? 'light dark' : scheme;
  if (bootstrap) root.dataset.bsTheme = scheme === 'system' ? (dark?.matches ? 'dark' : 'light') : scheme;
}

/** Applies the remembered choice. Call it before the application starts. */
export function startAppearance(): void {
  applyScheme();
  setMotion((read('motion') as Motion | null) ?? 'system');
  // With 'system' Bootstrap follows a change of the system while the page is open
  dark?.addEventListener('change', applyScheme);
}

export const APPEARANCE_TEXTS = {
  theme: 'Vzhled', default: 'výchozí', bootstrap: 'Bootstrap',
  scheme: 'Režim', system: 'podle systému', light: 'světlý', dark: 'tmavý',
  motion: 'Animace', on: 'zapnuté', off: 'vypnuté',
};

/** Three selects: theme, mode and animations. */
export function AppearanceSwitch(props: { texts?: typeof APPEARANCE_TEXTS }): Child {
  const texts = props.texts ?? APPEARANCE_TEXTS;
  const choice = <T extends string>(label: string, values: T[], current: () => T, change: (value: T) => void) => (
    <label>
      {label}{' '}
      <select onChange={event => change(event.currentTarget.value as T)}>
        <For each={() => values}>
          {value => <option value={value} selected={() => current() === value}>{texts[value as keyof typeof texts]}</option>}
        </For>
      </select>
    </label>
  );
  return (
    <div class="appearance">
      {choice<Look>(texts.theme, ['default', 'bootstrap'], () => look, value => {
        write('theme', value);
        // The other CSS is loaded with the page; a theme in the URL would win over the choice
        const url = new URL(location.href);
        url.searchParams.delete('theme');
        location.replace(url);
      })}
      {choice<Scheme>(texts.scheme, ['system', 'light', 'dark'], () => scheme, value => {
        scheme = value;
        write('scheme', value);
        applyScheme();
      })}
      {choice<Motion>(texts.motion, ['system', 'on', 'off'], motion, value => {
        write('motion', value);
        setMotion(value);
      })}
    </div>
  );
}
