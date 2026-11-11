/**
 * What DropDownList and ComboBox share: items, loading them, the list with highlighted text,
 * moving through it by the keyboard and placing the panel next to the control.
 */

import { Else, For, If } from '../ui/flow';
import { effect, onCleanup, state, untrack } from '../reactive/reactive';
import type { Child } from '../ui/dom';
import { classes } from '../ui/theme';
import { FormControl, toPairs } from './controls';
import type { Items } from './controls';

export interface ListOptions<T> {
  /** Fixed items, filtered in the browser. */
  items?: Items<T>;
  /** Items for the typed text, e.g. from the server. Called with '' when the list opens. */
  search?: (query: string) => Promise<Items<T>> | Items<T>;
  /** Label of a value set from code, when it is not among the items, e.g. after setDefaults(). */
  label?: (value: T) => Promise<string | null> | string | null;
  /** Text shown while nothing is selected. */
  placeholder?: string;
}

/** How long typing has to pause before `search` is called. */
const DEBOUNCE_MS = 250;

let lastList = 0;

/**
 * Text for searching: lower case and without diacritics, so 'nap' finds 'Nápoje'.
 * Character by character, so positions in it are positions in the original text.
 */
export function foldText(text: string): string {
  return text.split('').map(char => char.normalize('NFD')[0]!.toLowerCase()).join('');
}

export { toPairs };

export abstract class ListControl<T> extends FormControl<T | null> {
  readonly selected = state<T | null>(null);
  /** Label of the selected value. */
  readonly selectedLabel = state('');
  readonly opened = state(false);
  readonly items = state<[T, string][]>([]);
  /** Index of the item highlighted by the keyboard, -1 for none. */
  readonly active = state(-1);
  /** The text the items are searched by. */
  readonly query = state('');
  placeholder: string;
  protected readonly listId: string;
  private all: [T, string][] = [];
  private request = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(label: string, protected options: ListOptions<T>, idPrefix: string) {
    super(label);
    this.listId = `${idPrefix}${++lastList}`;
    this.placeholder = options.placeholder ?? '';
    if (options.items) this.setItems(options.items);
  }

  setItems(items: Items<T>): this {
    this.all = toPairs(items);
    return this;
  }

  setPlaceholder(placeholder: string): this {
    this.placeholder = placeholder;
    return this;
  }

  getValue(): T | null {
    return this.selected();
  }

  /**
   * Sets the value. The label can be given, e.g. when the data from the server have it already,
   * otherwise it comes from the items, or from the `label` option.
   */
  setValue(value: T | null, label?: string): void {
    this.selected.set(value ?? null);
    if (value === null || value === undefined) {
      this.selectedLabel.set('');
      return;
    }
    if (label !== undefined) {
      this.selectedLabel.set(label);
      return;
    }
    const known = this.findItem(value);
    if (known) {
      this.selectedLabel.set(known[1]);
      return;
    }
    this.selectedLabel.set(String(value));
    void Promise.resolve(this.options.label?.(value) ?? null).then(label => {
      if (label !== null && Object.is(untrack(this.selected), value)) this.selectedLabel.set(label);
    });
  }

  isFilled(): boolean {
    return this.selected() !== null;
  }

  close(): void {
    this.opened.set(false);
    this.active.set(-1);
  }

  /** Selects an item from the list and closes it. */
  pick(value: T, label: string): void {
    this.selected.set(value);
    this.selectedLabel.set(label);
    this.close();
    this.changed();
  }

  protected findItem(value: T): [T, string] | undefined {
    return [...this.all, ...untrack(this.items)].find(([item]) => Object.is(item, value));
  }

  /** Searches for the text: fixed items at once, `search` after a pause in typing. */
  protected searchFor(text: string): void {
    this.query.set(text);
    this.active.set(-1);
    clearTimeout(this.timer);
    const query = text.trim();
    if (this.options.search) this.timer = setTimeout(() => void this.load(query), DEBOUNCE_MS);
    else void this.load(query);
  }

  /** Fixed items are filtered here, otherwise `search` is asked. An older answer never overwrites a newer one. */
  protected async load(query: string): Promise<void> {
    clearTimeout(this.timer);
    const request = ++this.request;
    let items: [T, string][];
    if (this.options.search) {
      items = toPairs(await this.options.search(query));
    } else {
      const folded = foldText(query);
      items = this.all.filter(([, label]) => foldText(label).includes(folded));
    }
    if (request !== this.request) return;
    // The selected value may be far in the data, e.g. beyond the first 100 records a search returns.
    // Without a search text it is put first, so the user sees what is selected.
    const selected = untrack(this.selected);
    if (query === '' && selected !== null && !items.some(([item]) => Object.is(item, selected))) {
      items = [[selected, untrack(this.selectedLabel)], ...items];
    }
    this.items.set(items);
    this.active.set(-1);
  }

  /** Arrow keys move the highlight. Returns whether the key was one of them. */
  protected moveActive(event: KeyboardEvent, stopAtFirst = false): boolean {
    const last = untrack(this.items).length - 1;
    const active = untrack(this.active);
    if (event.key === 'ArrowDown') this.active.set(Math.min(active + 1, last));
    else if (event.key === 'ArrowUp') this.active.set(Math.max(active - 1, stopAtFirst ? 0 : -1));
    else return false;
    event.preventDefault();
    return true;
  }

  /** The highlighted item, if any. */
  protected activeItem(): [T, string] | undefined {
    return untrack(this.items)[untrack(this.active)];
  }

  /** Items of the list, or a line saying there are none. `slot` gives classes of the theme. */
  protected renderItems(slot: (name: string) => string, noResults: () => string): Child {
    return (
      <If when={() => this.items().length}>
        <For each={this.items}>
          {([value, label], index) => (
            <li
              role="option"
              id={() => `${this.listId}-${index()}`}
              aria-selected={() => String(Object.is(this.selected(), value))}
              data-value={String(value)}
              class={() => classes(
                slot('item'),
                this.active() === index() && slot('itemActive'),
                Object.is(this.selected(), value) && slot('itemSelected'),
              ) || null}
              ref={item => this.scrollWhenActive(item, index)}
              // mousedown, so the focus stays in the field until the pick
              onMousedown={event => {
                event.preventDefault();
                this.pick(value, label);
              }}
            >
              {() => highlight(label, this.query().trim(), slot('mark'))}
            </li>
          )}
        </For>
      <Else />
        <li role="option" aria-disabled="true" class={slot('noResults')}>{noResults()}</li>
      </If>
    );
  }

  /** Cleans up a pending search. Call it while rendering. */
  protected cleanUpSearch(): void {
    onCleanup(() => clearTimeout(this.timer));
  }

  /** Keeps the highlighted and the selected item in view. */
  private scrollWhenActive(item: HTMLElement, index: () => number): void {
    effect(() => {
      const visible = this.active() === index() || (this.active() < 0 && item.getAttribute('aria-selected') === 'true');
      if (visible) item.scrollIntoView?.({ block: 'nearest' });
    });
  }

  /** Places the panel next to the control, see placePanel(). */
  protected place(panel: HTMLElement, list: HTMLElement): void {
    placePanel(() => this.element, panel, list);
  }
}

/**
 * Places the panel `fixed` next to the control. Unlike `absolute` in the PHP versions,
 * a dialog or another scrolling container around it does not cut it off.
 *
 * It opens below. When the whole list would not fit there and there is more room above,
 * it opens above. When it fits on neither side, the list gets shorter. The side is chosen by the
 * full height of the list, not by the items shown now, so it does not jump while the user types.
 * `list` is the scrolling part of the panel, or the panel itself.
 */
export function placePanel(anchorOf: () => Element | null, panel: HTMLElement, list: HTMLElement): void {
  const GAP = 2;
  const update = () => {
    const anchor = anchorOf()?.getBoundingClientRect();
    if (!anchor) return;

    list.style.maxHeight = '';
    const style = getComputedStyle(list);
    // max-height limits the content of the list, its padding and border come on top of it
    const listChrome = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
      .reduce((sum, name) => sum + (Number.parseFloat(style[name as 'paddingTop']) || 0), 0);
    const rest = panel.offsetHeight - list.offsetHeight + listChrome;
    const needed = rest + (Number.parseFloat(style.maxHeight) || 200);
    const below = window.innerHeight - anchor.bottom - GAP * 2;
    const above = anchor.top - GAP * 2;
    const up = below < needed && above > below;
    const room = up ? above : below;
    if (room < needed) list.style.maxHeight = `${Math.max(room - rest, 60)}px`;

    panel.dataset.placement = up ? 'top' : 'bottom';
    Object.assign(panel.style, {
      display: 'block',
      position: 'fixed',
      // Above, the panel is held by its bottom edge, so it stays at the control when the list gets shorter
      top: up ? 'auto' : `${anchor.bottom + GAP}px`,
      bottom: up ? `${window.innerHeight - anchor.top + GAP}px` : 'auto',
      left: `${anchor.left}px`,
      width: `${anchor.width}px`,
      margin: '0',
    });
  };
  update();
  // The height of the panel is known once it is in the page (jsdom has no requestAnimationFrame)
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(update);
  else setTimeout(update);
  window.addEventListener('scroll', update, true);
  window.addEventListener('resize', update);
  onCleanup(() => {
    window.removeEventListener('scroll', update, true);
    window.removeEventListener('resize', update);
  });
}

/** The label with the searched text in <mark>, as text, never as HTML. Diacritics do not matter. */
export function highlight(label: string, query: string, markClass: string): Child {
  const at = query ? foldText(label).indexOf(foldText(query)) : -1;
  if (at < 0) return label;
  return [
    label.slice(0, at),
    <mark class={markClass || null}>{label.slice(at, at + query.length)}</mark>,
    label.slice(at + query.length),
  ];
}
