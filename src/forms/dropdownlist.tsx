/**
 * DropDownList: a select with a search field, taken over from phloxcz/forms-dropdownlist.
 * The same HTML classes, keyboard and look, so a list rendered by the server and one in the SPA match.
 * Instead of a URL it gets its items, or a function that searches them, typically an RPC call.
 */

import { If } from '../ui/flow';
import { untrack } from '../reactive/reactive';
import type { Child } from '../ui/dom';
import { classes, currentTheme } from '../ui/theme';
import type { ExtraAttributes } from './controls';
import { ListControl } from './listbox';
import type { ListOptions } from './listbox';

export type DropDownListOptions<T> = ListOptions<T>;

export class DropDownList<T = string> extends ListControl<T> {
  /** Texts of the list. Replace them for the language of the application: DropDownList.texts.noResults = '...'. */
  static texts = {
    noResults: 'No results',
    filterPlaceholder: 'Search…',
  };

  constructor(label = '', options: DropDownListOptions<T> = {}) {
    super(label, options, 'dropdownlist');
  }

  open(): void {
    if (untrack(this.opened) || untrack(this.disabled)) return;
    this.query.set('');
    this.active.set(-1);
    this.opened.set(true);
    void this.load('');
  }

  /** After a pick the focus returns to the button, so the user can go on by Tab. */
  override pick(value: T, label: string): void {
    super.pick(value, label);
    this.element?.focus();
  }

  private onFilterKey(event: KeyboardEvent): void {
    if (this.moveActive(event)) return;
    const item = this.activeItem();
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        if (item) this.pick(...item);
        break;
      case 'Tab':
        if (item) this.pick(...item);
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
    this.cleanUpSearch();

    return (
      <div
        class={classes(slot('wrapper'), attributes.class as string)}
        ref={element => { wrapper = element; }}
        // Closes when the focus leaves the whole widget, also by a click outside
        onFocusout={event => {
          if (wrapper.contains(event.relatedTarget as Node | null)) return;
          this.close();
          (onBlur as (event: FocusEvent) => void)(event);
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
            ref={panel => this.place(panel, panel.querySelector('.dropdownlist-list')!)}
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
                onInput={event => this.searchFor(event.currentTarget.value)}
                onKeydown={event => this.onFilterKey(event)}
              />
            </div>
            <ul role="listbox" id={this.listId} class="dropdownlist-list">
              {this.renderItems(slot, () => DropDownList.texts.noResults)}
            </ul>
          </div>
        </If>
      </div>
    );
  }
}
