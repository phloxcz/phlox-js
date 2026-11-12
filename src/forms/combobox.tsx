/**
 * ComboBox: a text field with a list of suggestions, taken over from phloxcz/forms-combobox.
 * The value is an item picked from the list. Typed text that is not an item is thrown away
 * when the user leaves the field, unless `allowCustom` is on: then the typed text is the value.
 */

import { If } from '../ui/flow';
import { state, untrack } from '../reactive/reactive';
import type { Child } from '../ui/dom';
import { classes, currentTheme } from '../ui/theme';
import type { ExtraAttributes } from './controls';
import { ListControl, foldText } from './listbox';
import type { ListOptions } from './listbox';

export type ComboBoxOptions<T, O = never> = ListOptions<T, O> & {
  /** Typed text that is not an item becomes the value. Only for fields that can hold a text. */
  allowCustom?: boolean;
};

/** With item objects the template shows in the list only, the field shows the text of the item. */
export class ComboBox<T = string> extends ListControl<T> {
  /** Texts of the list. Replace them for the language of the application. */
  static texts = {
    noResults: 'No results',
  };

  /** True while the field shows what the user is typing, not the label of the value. */
  readonly editing = state(false);
  private previous: { value: T | null; label: string; custom: boolean } = { value: null, label: '', custom: false };
  private custom = false;

  constructor(label = '', protected override options: ComboBoxOptions<T, any> = {}) {
    super(label, options, 'combobox');
  }

  /** Whether the value is a typed text, not an item. Only with `allowCustom`. */
  isCustom(): boolean {
    return this.custom;
  }

  override setValue(value: T | null, label?: unknown): void {
    this.editing.set(false);
    this.custom = false;
    super.setValue(value, label);
  }

  override pick(value: T, label: string): void {
    this.editing.set(false);
    this.custom = false;
    super.pick(value, label);
  }

  /** The field gets the focus: the list opens with the first items, the current value is remembered for Escape. */
  open(): void {
    if (untrack(this.opened) || untrack(this.disabled)) return;
    this.remember();
    this.opened.set(true);
    void this.load(untrack(this.editing) ? untrack(this.query) : '');
  }

  /** The value Escape returns to: the one before the list opened or before typing started. */
  private remember(): void {
    if (untrack(this.editing)) return;
    this.previous = { value: untrack(this.selected), label: untrack(this.selectedLabel), custom: this.custom };
  }

  /** Escape: back to the value before editing. */
  restore(): void {
    this.editing.set(false);
    this.selected.set(this.previous.value);
    this.selectedLabel.set(this.previous.label);
    this.custom = this.previous.custom;
    this.close();
  }

  /**
   * Settles typed text: an item with exactly this label is picked, otherwise the text becomes the value
   * (with allowCustom), or it is thrown away and the previous value returns.
   */
  commit(): void {
    if (!untrack(this.editing)) return;
    const typed = untrack(this.query).trim();
    const match = untrack(this.items).find(([, label]) => foldText(label) === foldText(typed));
    if (typed === '') {
      this.editing.set(false);
      this.custom = false;
      this.selected.set(null);
      this.selectedLabel.set('');
    } else if (match) {
      this.pick(...match);
    } else if (this.options.allowCustom) {
      this.editing.set(false);
      this.custom = true;
      this.selected.set(typed as T);
      this.selectedLabel.set(typed);
    } else {
      this.restore();
    }
  }

  /** Typed text is settled before the rules are checked, e.g. when Enter sends the form. */
  override validate(): boolean {
    this.commit();
    return super.validate();
  }

  private onKey(event: KeyboardEvent): void {
    const opened = untrack(this.opened);
    if (event.key === 'ArrowDown' && !opened) {
      event.preventDefault();
      this.open();
      return;
    }
    if (opened && this.moveActive(event, true)) return;
    const item = opened ? this.activeItem() : undefined;
    switch (event.key) {
      case 'Enter':
        // With nothing highlighted, Enter sends the form as in any text field
        if (item) {
          event.preventDefault();
          this.pick(...item);
        }
        break;
      case 'Tab':
        if (item) this.pick(...item);
        else this.commit();
        this.close();
        break;
      case 'Escape':
        // Only an open list reacts, so Escape in a closed field still closes a dialog around it
        if (opened) {
          event.preventDefault();
          event.stopPropagation();
          this.restore();
        }
        break;
    }
  }

  render(attributes: ExtraAttributes): Child {
    const theme = currentTheme();
    const slot = (name: string) => theme.class(`combobox.${name}`);
    const { id, ref, onBlur, ...common } = this.attrs();
    let wrapper: HTMLElement;
    this.cleanUpSearch();

    return (
      <div
        class={classes(slot('wrapper'), attributes.class as string)}
        ref={element => { wrapper = element; }}
        onFocusout={event => {
          if (wrapper.contains(event.relatedTarget as Node | null)) return;
          this.commit();
          this.close();
          (onBlur as (event: FocusEvent) => void)(event);
        }}
      >
        <input
          type="text"
          {...attributes}
          {...common}
          id={id as string}
          ref={ref as (element: HTMLElement) => void}
          class={this.classFor({}, 'combobox.input')}
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={() => String(this.opened())}
          aria-controls={this.listId}
          aria-activedescendant={() => (this.opened() && this.active() >= 0 ? `${this.listId}-${this.active()}` : null)}
          placeholder={this.placeholder || null}
          value={() => (this.editing() ? this.query() : this.selectedLabel())}
          onFocus={() => this.open()}
          onClick={() => this.open()}
          onInput={event => {
            const text = event.currentTarget.value;
            this.remember();
            this.editing.set(true);
            // Until an item is picked, the value is none, or the typed text with allowCustom
            this.custom = Boolean(this.options.allowCustom && text.trim());
            this.selected.set(this.custom ? (text.trim() as T) : null);
            this.opened.set(true);
            this.searchFor(text);
            this.changed();
          }}
          onKeydown={event => this.onKey(event)}
        />

        <If when={this.opened}>
          <ul
            role="listbox"
            id={this.listId}
            class={slot('dropdown')}
            data-combobox-panel
            ref={list => this.place(list, list)}
          >
            {this.renderItems(slot, () => ComboBox.texts.noResults)}
          </ul>
        </If>
      </div>
    );
  }
}
