/**
 * Tabs: a row of tabs over panels, only the panel of the chosen tab is visible.
 *
 *   <Tabs>
 *     <Tab title="Název a popis">…</Tab>
 *     <Tab title="Varianty">…</Tab>
 *   </Tabs>
 *
 * The panels stay in the page when hidden, so the controls of a form in them keep their values and are
 * validated. A control that gets the focus from a hidden panel (the first error after a failed validation)
 * switches to its tab, and a tab with an error in its panel has a mark. Tabs that do not fit are behind "More".
 */

import { effect, onCleanup, state, untrack } from '../reactive/reactive';
import type { State } from '../reactive/reactive';
import { templateOf } from './dom';
import type { Child } from './dom';
import { Dropdown, DropdownItem } from './dropdown';
import { REVEAL } from './reveal';
import { texts } from './texts';
import { classes, currentTheme } from './theme';

export const tabsTexts = texts('tabs', { more: 'More', hasErrors: 'contains an error' });

export interface TabProps {
  /** Text or a template (an icon and text); it is shown in the tab and in the menu "More" too. */
  title: Child;
  children?: Child;
}

export interface TabsProps {
  /** The index of the chosen tab; a state of the caller lets it keep the tab, e.g. in the URL or by preference(). */
  selected?: State<number>;
  'aria-label'?: string;
  /** Classes of the whole, added to the theme slot `tabs`. */
  class?: string;
  children?: Child;
}

/** A tab of <Tabs>, it can be used only directly inside it. */
export function Tab(_props: TabProps): Child {
  throw new Error('<Tab> can be used only directly inside <Tabs>.');
}

/**
 * Which tabs are shown when they need `widths` and there is `available` room: as many from the start as fit
 * next to the button "More" (`moreWidth`). The chosen one is shown always, instead of the last that fits.
 */
export function fitTabs(widths: number[], available: number, moreWidth: number, selected: number): boolean[] {
  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total <= available) return widths.map(() => true);
  const room = available - moreWidth - (widths[selected] ?? 0);
  const shown = widths.map((_, index) => index === selected);
  let used = 0;
  for (let index = 0; index < widths.length; index++) {
    if (index === selected) continue;
    used += widths[index]!;
    if (used > room) break;
    shown[index] = true;
  }
  return shown;
}

let lastId = 0;

export function Tabs(props: TabsProps): Child {
  const theme = currentTheme();
  const children = (Array.isArray(props.children) ? props.children : [props.children]) as Child[];
  const tabs = children.filter(child => child != null && child !== false).map(child => {
    const template = templateOf(child);
    if (template?.tag !== Tab) throw new Error('<Tabs> may contain only <Tab> elements.');
    return { ...(template.props as unknown as TabProps), children: template.children };
  });
  const selected = props.selected ?? state(0);
  const shown = state(tabs.map(() => true));
  const invalid = state(tabs.map(() => false));
  const id = `phlox-tabs-${++lastId}`;
  const buttons: HTMLButtonElement[] = [];
  let nav: HTMLElement | undefined;
  let more: HTMLElement | undefined;

  const choose = (index: number, focus = false): void => {
    selected.set(index);
    if (focus) buttons[index]?.focus();
  };

  // Arrows, Home and End go over the shown tabs and choose at once, as WAI-ARIA describes tabs
  const keydown = (event: KeyboardEvent): void => {
    const order = tabs.map((_, index) => index).filter(index => untrack(shown)[index]);
    const at = order.indexOf(untrack(selected));
    const next = { ArrowRight: order[(at + 1) % order.length], ArrowLeft: order[(at - 1 + order.length) % order.length], Home: order[0], End: order.at(-1) }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    choose(next, true);
  };

  // The tabs that fit; measured with all of them shown, then the rest goes to "More"
  const measure = (): void => {
    if (!nav?.isConnected || !more) return;
    for (const button of buttons) button.hidden = false;
    more.hidden = false;
    const widths = buttons.map(button => button.getBoundingClientRect().width);
    shown.set(fitTabs(widths, nav.clientWidth, more.getBoundingClientRect().width, untrack(selected)));
  };
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => measure());
    queueMicrotask(() => nav && observer.observe(nav));
    onCleanup(() => observer.disconnect());
  }
  // The chosen tab must be among the shown ones
  effect(() => {
    if (!shown()[selected()]) untrack(measure);
  });

  /** A panel: switches to its tab when something inside it asks to be shown, marks its tab when it has an error. */
  const watch = (panel: HTMLElement, index: number): void => {
    panel.addEventListener(REVEAL, () => choose(index));
    const update = (): void => {
      const has = panel.querySelector('[aria-invalid="true"]') !== null;
      if (untrack(invalid)[index] !== has) invalid.set(untrack(invalid).map((value, at) => (at === index ? has : value)));
    };
    const observer = new MutationObserver(update);
    observer.observe(panel, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-invalid'] });
    onCleanup(() => observer.disconnect());
    update();
  };

  return (
    <div class={classes(theme.class('tabs'), props.class)}>
      <div class={theme.class('tabs.nav')} ref={element => { nav = element; }}>
        <div role="tablist" class="phlox-tablist" aria-label={props['aria-label'] ?? null} onKeydown={keydown}>
          {tabs.map((tab, index) => (
            <button type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`}
              aria-selected={() => String(selected() === index)} tabIndex={() => (selected() === index ? 0 : -1)}
              hidden={() => !shown()[index]}
              class={() => classes(theme.class('tabs.tab'), selected() === index && theme.class('tabs.tabActive'))}
              ref={element => { buttons[index] = element as HTMLButtonElement; }}
              onClick={() => choose(index)}>
              {tab.title}
              {() => (invalid()[index] ? <span class="phlox-tab-error"><span class="phlox-visually-hidden">{tabsTexts.hasErrors}</span></span> : null)}
            </button>
          ))}
        </div>
        <div class="phlox-tabs-more" hidden={() => shown().every(Boolean)} ref={element => { more = element; }}>
          <Dropdown class={theme.class('tabs.more')} label={tabsTexts.more} placement="bottom-right">
            {() => tabs.map((tab, index) => (untrack(shown)[index] ? null : <DropdownItem onClick={() => choose(index)}>{tab.title}</DropdownItem>))}
          </Dropdown>
        </div>
      </div>
      {tabs.map((tab, index) => (
        <div role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} class={theme.class('tabs.panel')}
          hidden={() => selected() !== index} ref={element => watch(element, index)}>
          {tab.children}
        </div>
      ))}
    </div>
  );
}
