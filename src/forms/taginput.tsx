/**
 * TagInput: several values as tags, taken over from phloxcz/forms-taginput.
 * Tags are picked from suggestions shown while typing, or with `allowNew` made of the typed text.
 * Comma and Enter add a tag, Backspace in an empty field removes the last one.
 */

import { For, If } from '../ui/flow';
import { computed, onCleanup, state, untrack } from '../reactive/reactive';
import type { Child } from '../ui/dom';
import { classes, currentTheme } from '../ui/theme';
import { FormControl } from './controls';
import type { ExtraAttributes, Items } from './controls';
import { foldText, highlight, placePanel, toPairs } from './listbox';

export interface TagInputOptions<T> {
  /** Fixed suggestions, filtered in the browser. */
  items?: Items<T>;
  /** Suggestions for the typed text, e.g. from the server. */
  search?: (query: string) => Promise<Items<T>> | Items<T>;
  /** Label of a value set from code, when it is not among the items. */
  label?: (value: T) => Promise<string | null> | string | null;
  /** Typed text that is not a suggestion becomes a new tag. Only for lists of texts. */
  allowNew?: boolean;
  /** At most this many tags, 0 = no limit. */
  maxTags?: number;
  placeholder?: string;
}

export interface Tag<T> {
  value: T;
  label: string;
  /** Made of typed text, not picked from the suggestions. */
  isNew: boolean;
}

/** How long typing has to pause before `search` is called. */
const DEBOUNCE_MS = 250;

let lastTagInput = 0;

export class TagInput<T = string> extends FormControl<T[]> {
  /** Texts of the control. Replace them for the language of the application. */
  static texts = {
    createNew: 'Create: ',
    remove: 'Remove',
  };

  readonly tags = state<Tag<T>[]>([]);
  readonly text = state('');
  /** Suggestions for the typed text, without tags already added. The last one may be a new tag. */
  readonly suggestions = state<Tag<T>[]>([]);
  readonly active = state(-1);
  readonly focused = state(false);
  readonly opened = computed(() => this.suggestions().length > 0 && this.text().trim() !== '' && !this.full());
  placeholder: string;
  private all: [T, string][] = [];
  private request = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly listId = `taginput${++lastTagInput}`;
  /** Leaving the field validates, but does not turn the typed text into a tag. */
  private leaving = false;

  constructor(label = '', private options: TagInputOptions<T> = {}) {
    super(label);
    this.placeholder = options.placeholder ?? '';
    if (options.items) this.setItems(options.items);
  }

  setItems(items: Items<T>): this {
    this.all = toPairs(items);
    return this;
  }

  getValue(): T[] {
    return this.tags().map(tag => tag.value);
  }

  /** Values picked from the suggestions and texts of new tags apart, like getSplitValue() in PHP. */
  getSplitValue(): { picked: T[]; created: string[] } {
    const tags = this.tags();
    return {
      picked: tags.filter(tag => !tag.isNew).map(tag => tag.value),
      created: tags.filter(tag => tag.isNew).map(tag => String(tag.value)),
    };
  }

  /**
   * Sets the tags. Labels can be given, e.g. when the data from the server have them,
   * otherwise they come from the items, or from the `label` option.
   */
  setValue(values: T[], labels?: string[]): void {
    const tags = (values ?? []).map((value, index): Tag<T> => {
      const label = labels?.[index] ?? this.all.find(([item]) => Object.is(item, value))?.[1];
      return { value, label: label ?? String(value), isNew: false };
    });
    this.tags.set(tags);
    for (const tag of tags) {
      if (labels?.[tags.indexOf(tag)] !== undefined || this.all.some(([item]) => Object.is(item, tag.value))) continue;
      void Promise.resolve(this.options.label?.(tag.value) ?? null).then(label => {
        if (label !== null) this.tags.update(list => list.map(other => (other === tag ? { ...tag, label } : other)));
      });
    }
  }

  isFilled(): boolean {
    return this.tags().length > 0;
  }

  /** Whether the limit of tags is reached. */
  full(): boolean {
    const max = this.options.maxTags ?? 0;
    return max > 0 && this.tags().length >= max;
  }

  /** Adds a tag unless it is there already (texts regardless of case) or the limit is reached. */
  add(value: T, label: string, isNew = false): boolean {
    if (this.has(value) || untrack(() => this.full())) return false;
    this.tags.update(list => [...list, { value, label, isNew }]);
    this.text.set('');
    this.suggestions.set([]);
    this.changed();
    return true;
  }

  remove(tag: Tag<T>): void {
    this.tags.update(list => list.filter(other => other !== tag));
    this.changed();
  }

  /**
   * Turns typed text into a tag: a suggestion with exactly this label, or a new tag with allowNew.
   * Returns whether a tag was added.
   */
  commitText(text: string): boolean {
    const typed = text.trim();
    if (!typed) return false;
    const exact = [...this.all, ...untrack(this.suggestions).filter(tag => !tag.isNew).map(tag => [tag.value, tag.label] as [T, string])]
      .find(([, label]) => foldText(label) === foldText(typed));
    if (exact) return this.add(exact[0], exact[1]);
    if (this.options.allowNew) return this.add(typed as T, typed, true);
    return false;
  }

  /**
   * Text left in the field becomes a tag before the rules are checked, as it would after Enter.
   * Not when the user only leaves the field: a new tag would make the form taller, and a click on a button
   * below it, e.g. Save, would end somewhere else.
   */
  override validate(): boolean {
    if (!this.leaving && this.commitText(untrack(this.text))) this.text.set('');
    return super.validate();
  }

  private has(value: T): boolean {
    const folded = typeof value === 'string' ? foldText(value) : null;
    return untrack(this.tags).some(tag =>
      Object.is(tag.value, value) || (folded !== null && typeof tag.value === 'string' && foldText(tag.value) === folded));
  }

  /** Suggestions for the text: matching items not yet added, then a new tag when allowed and not an exact item. */
  private async suggest(text: string): Promise<void> {
    const query = text.trim();
    const request = ++this.request;
    if (!query) {
      this.suggestions.set([]);
      return;
    }
    let found: [T, string][];
    if (this.options.search) {
      found = toPairs(await this.options.search(query));
    } else {
      const folded = foldText(query);
      found = this.all.filter(([, label]) => foldText(label).includes(folded));
    }
    if (request !== this.request) return;
    const suggestions: Tag<T>[] = found.filter(([value]) => !this.has(value)).map(([value, label]) => ({ value, label, isNew: false }));
    const exact = found.some(([, label]) => foldText(label) === foldText(query));
    if (this.options.allowNew && !exact && !this.has(query as T)) suggestions.push({ value: query as T, label: query, isNew: true });
    this.suggestions.set(suggestions);
    this.active.set(-1);
  }

  private onInput(value: string): void {
    // A comma adds the highlighted or first suggestion, or the text before it
    const comma = value.indexOf(',');
    if (comma >= 0) {
      const before = value.slice(0, comma);
      const suggestion = untrack(this.opened) ? untrack(this.suggestions)[Math.max(untrack(this.active), 0)] : undefined;
      if (suggestion) this.add(suggestion.value, suggestion.label, suggestion.isNew);
      else if (!this.commitText(before)) this.text.set(before.trim());
      return;
    }
    this.text.set(value);
    clearTimeout(this.timer);
    if (this.options.search && value.trim()) this.timer = setTimeout(() => void this.suggest(value), DEBOUNCE_MS);
    else void this.suggest(value);
  }

  private onKey(event: KeyboardEvent): void {
    const opened = untrack(this.opened);
    const suggestions = untrack(this.suggestions);
    const active = untrack(this.active);
    switch (event.key) {
      case 'Enter':
        // Enter adds a tag and never sends the form, as in the PHP version
        event.preventDefault();
        if (opened) {
          const suggestion = suggestions[Math.max(active, 0)]!;
          this.add(suggestion.value, suggestion.label, suggestion.isNew);
        } else {
          this.commitText(untrack(this.text));
        }
        break;
      case 'Backspace':
        if (untrack(this.text) === '' && untrack(this.tags).length > 0) {
          event.preventDefault();
          this.remove(untrack(this.tags).at(-1)!);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (opened) this.active.set((active + 1) % suggestions.length);
        else void this.suggest(untrack(this.text));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (opened) this.active.set((active - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Tab':
        if (opened && active >= 0) {
          event.preventDefault();
          const suggestion = suggestions[active]!;
          this.add(suggestion.value, suggestion.label, suggestion.isNew);
        }
        break;
      case 'Escape':
        // Only an open list reacts, so Escape otherwise still closes a dialog around it
        if (opened) {
          event.preventDefault();
          event.stopPropagation();
          this.suggestions.set([]);
        }
        break;
    }
  }

  render(attributes: ExtraAttributes): Child {
    const theme = currentTheme();
    const slot = (name: string) => theme.class(`taginput.${name}`);
    const { id, ref, onBlur, required: _required, ...common } = this.attrs();
    let wrapper: HTMLElement;
    let container: HTMLElement;
    let input: HTMLInputElement;
    onCleanup(() => clearTimeout(this.timer));
    // Bootstrap btn-close draws its own cross
    const removeText = slot('tagRemove').includes('btn-close') ? null : '×';

    return (
      <div
        class={() => classes(slot('wrapper'), this.focused() && slot('focused'), attributes.class as string)}
        data-phlox-taginput
        ref={element => { wrapper = element; }}
        onFocusout={event => {
          if (wrapper.contains(event.relatedTarget as Node | null)) return;
          this.focused.set(false);
          this.suggestions.set([]);
          this.leaving = true;
          (onBlur as () => void)();
          this.leaving = false;
        }}
      >
        <div
          class={() => classes(slot('container'), this.focused() && slot('focused'), this.hasErrors() && slot('invalid'))}
          role="group"
          aria-label={this.label.replace(/:\s*$/, '') || null}
          data-phlox-taginput-container
          ref={element => { container = element; }}
          onClick={event => {
            if (!(event.target as Element).closest('[data-phlox-taginput-remove]')) input.focus();
          }}
        >
          <For each={this.tags}>
            {tag => (
              <span
                class={classes(slot('tag'), tag.isNew ? slot('tagNew') : slot('tagExisting'))}
                data-phlox-taginput-tag
                data-value={String(tag.value)}
                data-is-new={tag.isNew ? '1' : '0'}
              >
                <span data-phlox-tag-label>{tag.label}</span>
                <button
                  type="button"
                  class={slot('tagRemove')}
                  tabIndex={-1}
                  data-phlox-taginput-remove
                  aria-label={`${TagInput.texts.remove} ${tag.label}`}
                  disabled={this.disabled}
                  onClick={event => {
                    event.stopPropagation();
                    this.remove(tag);
                    input.focus();
                  }}
                >
                  {removeText}
                </button>
              </span>
            )}
          </For>
          <input
            type="text"
            {...attributes}
            {...common}
            id={id as string}
            ref={element => {
              input = element as HTMLInputElement;
              (ref as (element: HTMLElement) => void)(element);
            }}
            class={slot('input')}
            autocomplete="off"
            spellcheck={false}
            role="combobox"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-expanded={() => String(this.opened())}
            aria-controls={this.listId}
            aria-activedescendant={() => (this.opened() && this.active() >= 0 ? `${this.listId}-${this.active()}` : null)}
            placeholder={() => (this.tags().length ? null : this.placeholder || null)}
            value={this.text}
            onFocus={() => this.focused.set(true)}
            onInput={event => {
              this.onInput(event.currentTarget.value);
              // A comma is never left in the field
              if (event.currentTarget.value !== untrack(this.text)) event.currentTarget.value = untrack(this.text);
            }}
            onKeydown={event => this.onKey(event)}
          />
        </div>

        <If when={this.opened}>
          <div
            role="listbox"
            id={this.listId}
            class={slot('dropdown')}
            data-phlox-taginput-dropdown
            ref={panel => placePanel(() => container, panel, panel)}
          >
            <For each={this.suggestions}>
              {(suggestion, index) => (
                <div
                  role="option"
                  id={() => `${this.listId}-${index()}`}
                  aria-selected={() => String(this.active() === index())}
                  class={() => classes(suggestion.isNew ? slot('optionNew') : slot('option'), this.active() === index() && slot('optionActive'))}
                  onMousedown={event => {
                    event.preventDefault();
                    this.add(suggestion.value, suggestion.label, suggestion.isNew);
                  }}
                >
                  {suggestion.isNew
                    ? [<strong>{TagInput.texts.createNew}</strong>, `"${suggestion.label}"`]
                    : () => highlight(suggestion.label, this.text().trim(), '')}
                </div>
              )}
            </For>
          </div>
        </If>
      </div>
    );
  }
}
