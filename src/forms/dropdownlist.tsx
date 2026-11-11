/**
 * DropDownList: a select with a search field, taken over from phloxcz/forms-dropdownlist.
 * The same HTML classes, keyboard and look, so a list rendered by the server and one in the SPA match.
 * Instead of a URL it gets its items, or a function that searches them, typically an RPC call.
 */

import { Else, For, If } from '../ui/flow';
import { effect, onCleanup, state, untrack } from '../reactive/reactive';
import type { Child } from '../ui/dom';
import { classes, currentTheme } from '../ui/theme';
import { FormControl } from './controls';
import type { ExtraAttributes, Items } from './controls';

export interface DropDownListOptions<T> {
  /** Fixed items, filtered in the browser. */
  items?: Items<T>;
  /** Items for the text typed in the search field, e.g. from the server. Called with '' when the list opens. */
  search?: (query: string) => Promise<Items<T>> | Items<T>;
  /** Label of a value set from code, when it is not among the items, e.g. after setDefaults(). */
  label?: (value: T) => Promise<string | null> | string | null;
  /** Text of the button while nothing is selected. */
  placeholder?: string;
}

/** Texts of the list. Replace them for the language of the application: DropDownList.texts.noResults = '...'. */
const texts = {
  noResults: 'No results',
  filterPlaceholder: 'Search…',
};

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

function toPairs<T>(items: Items<T>): [T, string][] {
  if (Array.isArray(items)) return items.map(([value, label]) => [value, label]);
  return Object.entries(items).map(([key, label]) => [(/^-?\d+$/.test(key) ? Number(key) : key) as T, label]);
}

export class DropDownList<T = string> extends FormControl<T | null> {
  static texts = texts;

  readonly selected = state<T | null>(null);
  /** Label shown in the button. */
  readonly selectedLabel = state('');
  readonly opened = state(false);
  readonly items = state<[T, string][]>([]);
  /** Index of the item highlighted by the keyboard, -1 for none. */
  readonly active = state(-1);
  readonly query = state('');
  placeholder: string;
  private all: [T, string][] = [];
  private request = 0;
  private readonly listId = `dropdownlist${++lastList}`;

  constructor(label = '', private options: DropDownListOptions<T> = {}) {
    super(label);
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

  /** Sets the value. Its label comes from the items, or from the `label` option. */
  setValue(value: T | null): void {
    this.selected.set(value ?? null);
    if (value === null || value === undefined) {
      this.selectedLabel.set('');
      return;
    }
    const known = [...this.all, ...untrack(this.items)].find(([item]) => Object.is(item, value));
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

  open(): void {
    if (untrack(this.opened) || untrack(this.disabled)) return;
    this.query.set('');
    this.active.set(-1);
    this.opened.set(true);
    void this.load('');
  }

  close(): void {
    this.opened.set(false);
    this.active.set(-1);
  }

  pick(value: T, label: string): void {
    this.selected.set(value);
    this.selectedLabel.set(label);
    this.close();
    this.element?.focus();
    this.changed();
  }

  /** Fixed items are filtered here, otherwise `search` is asked. An older answer never overwrites a newer one. */
  private async load(query: string): Promise<void> {
    const request = ++this.request;
    let items: [T, string][];
    if (this.options.search) {
      items = toPairs(await this.options.search(query));
    } else {
      const folded = foldText(query);
      items = this.all.filter(([, label]) => foldText(label).includes(folded));
    }
    if (request !== this.request) return;
    this.items.set(items);
    this.active.set(-1);
  }

  private onFilterKey(event: KeyboardEvent): void {
    const items = untrack(this.items);
    const active = untrack(this.active);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.active.set(Math.min(active + 1, items.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.active.set(Math.max(active - 1, -1));
        break;
      case 'Enter':
        event.preventDefault();
        if (items[active]) this.pick(...items[active]);
        break;
      case 'Tab':
        if (items[active]) this.pick(...items[active]);
        this.close();
        break;
      case 'Escape':
        // Only the list closes, not a dialog around it
        event.preventDefault();
        event.stopPropagation();
        this.close();
        this.element?.focus();
        break;
    }
  }

  render(attributes: ExtraAttributes): Child {
    const theme = currentTheme();
    const slot = (name: string) => theme.class(`dropdownlist.${name}`);
    // Validation on blur belongs to the whole widget, not to the button: opening the list moves the focus away from it
    const { id, ref, onBlur, required: _required, ...common } = this.attrs();
    let wrapper: HTMLElement;
    let timer: ReturnType<typeof setTimeout> | undefined;
    onCleanup(() => clearTimeout(timer));

    return (
      <div
        class={classes(slot('wrapper'), attributes.class as string)}
        ref={element => { wrapper = element; }}
        // Closes when the focus leaves the whole widget, also by a click outside
        onFocusout={event => {
          if (wrapper.contains(event.relatedTarget as Node | null)) return;
          this.close();
          (onBlur as () => void)();
        }}
      >
        <button
          type="button"
          {...common}
          id={id as string}
          ref={ref as (element: HTMLElement) => void}
          class={this.classFor({}, 'dropdownlist.trigger')}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={() => String(this.opened())}
          aria-controls={this.listId}
          aria-required={this.isRequired() ? 'true' : null}
          onClick={() => (untrack(this.opened) ? this.close() : this.open())}
          onKeydown={event => {
            if (event.key === 'Enter') event.preventDefault();
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              this.open();
            }
            if (event.key === 'Escape' && untrack(this.opened)) {
              event.preventDefault();
              event.stopPropagation();
              this.close();
            }
          }}
        >
          <span class={() => classes('dropdownlist-trigger-text', !this.selectedLabel() && 'dropdownlist-trigger-placeholder')}>
            {() => this.selectedLabel() || this.placeholder}
          </span>
          <span class="dropdownlist-trigger-arrow" aria-hidden="true" />
        </button>

        <If when={this.opened}>
          <div
            class={slot('dropdown')}
            data-dropdownlist-panel
            ref={panel => this.place(panel)}
          >
            <div class={slot('filterRow')}>
              <input
                type="text"
                class={slot('filterInput')}
                autocomplete="off"
                placeholder={DropDownList.texts.filterPlaceholder}
                aria-label={DropDownList.texts.filterPlaceholder}
                aria-controls={this.listId}
                aria-activedescendant={() => (this.active() >= 0 ? `${this.listId}-${this.active()}` : null)}
                value={this.query}
                ref={input => queueMicrotask(() => input.focus())}
                onInput={event => {
                  this.query.set(event.currentTarget.value);
                  this.active.set(-1);
                  clearTimeout(timer);
                  const query = event.currentTarget.value.trim();
                  if (this.options.search) timer = setTimeout(() => void this.load(query), DEBOUNCE_MS);
                  else void this.load(query);
                }}
                onKeydown={event => this.onFilterKey(event)}
              />
            </div>
            <ul role="listbox" id={this.listId} class="dropdownlist-list">
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
                      // mousedown, so the focus stays in the search field until the pick
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
                <li role="option" aria-disabled="true" class={slot('noResults')}>{DropDownList.texts.noResults}</li>
              </If>
            </ul>
          </div>
        </If>
      </div>
    );
  }

  /** Keeps the highlighted and the selected item in view. */
  private scrollWhenActive(item: HTMLElement, index: () => number): void {
    effect(() => {
      const visible = this.active() === index() || (this.active() < 0 && item.getAttribute('aria-selected') === 'true');
      if (visible) item.scrollIntoView?.({ block: 'nearest' });
    });
  }

  /**
   * The panel is placed `fixed` next to the button. Unlike `absolute` in the PHP version,
   * a dialog or another scrolling container around it does not cut it off.
   *
   * It opens below the button. When the whole list would not fit there and there is more room above,
   * it opens above. When it fits on neither side, the list gets shorter. The side is chosen by the
   * full height of the list, not by the items shown now, so it does not jump while the user types.
   */
  private place(panel: HTMLElement): void {
    const GAP = 2;
    const update = () => {
      const button = this.element?.getBoundingClientRect();
      const list = panel.querySelector<HTMLElement>('.dropdownlist-list');
      if (!button || !list) return;

      list.style.maxHeight = '';
      const style = getComputedStyle(list);
      // max-height limits the content of the list, its padding and border come on top of it
      const listChrome = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
        .reduce((sum, name) => sum + (Number.parseFloat(style[name as 'paddingTop']) || 0), 0);
      const rest = panel.offsetHeight - list.offsetHeight + listChrome;
      const needed = rest + (Number.parseFloat(style.maxHeight) || 200);
      const below = window.innerHeight - button.bottom - GAP * 2;
      const above = button.top - GAP * 2;
      const up = below < needed && above > below;
      const room = up ? above : below;
      if (room < needed) list.style.maxHeight = `${Math.max(room - rest, 60)}px`;

      panel.dataset.placement = up ? 'top' : 'bottom';
      Object.assign(panel.style, {
        display: 'block',
        position: 'fixed',
        // Above, the panel is held by its bottom edge, so it stays at the button when the list gets shorter
        top: up ? 'auto' : `${button.bottom + GAP}px`,
        bottom: up ? `${window.innerHeight - button.top + GAP}px` : 'auto',
        left: `${button.left}px`,
        width: `${button.width}px`,
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
}

/** The label with the searched text in <mark>, as text, never as HTML. Diacritics do not matter. */
function highlight(label: string, query: string, markClass: string): Child {
  const at = query ? foldText(label).indexOf(foldText(query)) : -1;
  if (at < 0) return label;
  return [
    label.slice(0, at),
    <mark class={markClass || null}>{label.slice(at, at + query.length)}</mark>,
    label.slice(at + query.length),
  ];
}
