/**
 * One node of a tree in a drop-down, like a DropDownList whose items are a tree. Closed it shows the way
 * from the top to the picked node, "Domácnost › Kuchyně › Nože"; open it shows the tree in a panel.
 */

import { If } from '../ui/flow';
import { computed, effect, onCleanup, state, untrack } from '../reactive/reactive';
import type { Child } from '../ui/dom';
import { classes, currentTheme } from '../ui/theme';
import { Tree } from '../components/tree';
import type { TreeItem, TreeKey, TreeNode } from '../components/tree';
import { TreeView } from '../components/treeview';
import { FormControl } from './controls';
import type { ExtraAttributes } from './controls';
import { placePanel } from './listbox';
import type { TreeSelectOptions } from './treeselect';

let lastId = 0;

export interface DropDownTreeSelectOptions<K extends TreeKey> extends TreeSelectOptions<K> {
  /** Shown while nothing is picked. */
  placeholder?: string;
  /** Between the names in the way to the picked node. */
  separator?: string;
}

export class DropDownTreeSelect<K extends TreeKey> extends FormControl<K | null> {
  static texts = { clear: 'Clear' };

  readonly tree: Tree<TreeNode<K>>;
  /** The picked id, the value of the control. */
  private readonly picked = state<K | null>(null);
  readonly opened = state(false);
  /** True while the way to a node set from code is being loaded. */
  readonly loading = state(false);
  private readonly panelId = `phlox-dropdowntree-${++lastId}`;

  /** Nodes from the top down to the picked one, as far as they are loaded. Follows the tree, also a reload. */
  readonly path = computed((): TreeItem<TreeNode<K>>[] => {
    const id = this.picked();
    if (id === null) return [];
    const search = (items: TreeItem<TreeNode<K>>[]): TreeItem<TreeNode<K>>[] | null => {
      for (const item of items) {
        if (item.id === id) return [item];
        const below = search(item.children() ?? []);
        if (below) return [item, ...below];
      }
      return null;
    };
    return search(this.tree.roots()) ?? [];
  });

  constructor(label = '', readonly options: DropDownTreeSelectOptions<K> = {}) {
    super(label);
    this.tree = new Tree<TreeNode<K>>({ ...options });
    // Picking a node closes the panel and returns to the button
    this.tree.onSelect = node => {
      this.picked.set(node.id);
      this.close();
      this.element?.focus();
      this.changed();
    };
  }

  getValue(): K | null {
    return this.picked();
  }

  setValue(value: K | null): void {
    this.picked.set(value ?? null);
    this.tree.selected.set(value ?? null);
  }

  isFilled(): boolean {
    return this.picked() !== null;
  }

  open(): void {
    if (untrack(this.opened) || untrack(this.disabled)) return;
    // Closing the panel without a choice shows an error, as with DropDownList
    this.edited = true;
    this.opened.set(true);
  }

  close(): void {
    this.opened.set(false);
  }

  /** The text of the button: the way to the picked node. */
  private text(): string {
    const path = this.path();
    if (path.length) return path.map(item => item.node.label).join(this.options.separator ?? ' › ');
    const id = this.picked();
    return id === null ? '' : this.loading() ? '…' : String(id);
  }

  render(attributes: ExtraAttributes): Child {
    const theme = currentTheme();
    const slot = (name: string) => theme.class(`dropdownlist.${name}`);
    const { id, ref, onBlur, required: _required, ...common } = this.attrs();
    let wrapper: HTMLElement;

    // A node set from code is found in the tree: its way is loaded with the `path` option
    effect(() => {
      const value = this.picked();
      if (value === null || this.path().length) return;
      untrack(() => {
        this.loading.set(true);
        void this.tree.reveal(value).catch(() => null).finally(() => this.loading.set(false));
      });
    });

    return (
      <div
        class={classes(slot('wrapper'), 'phlox-dropdowntree', attributes.class as string)}
        ref={element => { wrapper = element; }}
        // Closes when the focus leaves the whole control, also by a click outside
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
          aria-haspopup="tree"
          aria-expanded={() => String(this.opened())}
          aria-controls={this.panelId}
          aria-required={this.isRequired() ? 'true' : null}
          title={() => this.text() || null}
          onClick={() => (untrack(this.opened) ? this.close() : this.open())}
          onKeydown={event => {
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              this.open();
            } else if (event.key === 'Escape' && untrack(this.opened)) {
              // Only the panel closes, not a dialog around it
              event.preventDefault();
              event.stopPropagation();
              this.close();
            } else if ((event.key === 'Delete' || event.key === 'Backspace') && !this.isRequired()) {
              event.preventDefault();
              this.clear();
            }
          }}
        >
          <span class={() => classes('dropdownlist-trigger-text', !this.text() && 'dropdownlist-trigger-placeholder')}>
            {() => this.text() || this.options.placeholder || ''}
          </span>
          <span class="dropdownlist-trigger-arrow" aria-hidden="true" />
        </button>
        <If when={() => !this.isRequired() && this.picked() !== null && !this.disabled()}>
          <button
            type="button"
            class="phlox-dropdowntree-clear"
            aria-label={DropDownTreeSelect.texts.clear}
            title={DropDownTreeSelect.texts.clear}
            tabIndex={-1}
            onClick={() => {
              this.clear();
              this.element?.focus();
            }}
          >
            ×
          </button>
        </If>

        <If when={this.opened}>
          <div
            class={classes(slot('dropdown'), 'phlox-dropdowntree-panel')}
            id={this.panelId}
            data-dropdownlist-panel
            ref={panel => {
              placePanel(() => this.element, panel, panel.querySelector<HTMLElement>('.phlox-tree')!);
              // The picked node is shown and gets the focus, the arrows go on from it
              const value = untrack(this.picked);
              void (value === null ? this.tree.load() : this.tree.reveal(value)).catch(() => null).then(() => {
                if (untrack(this.opened)) panel.querySelector<HTMLElement>('[role=tree]')?.focus();
              });
              const onKey = (event: KeyboardEvent): void => {
                if (event.key !== 'Escape') return;
                event.preventDefault();
                event.stopPropagation();
                this.close();
                this.element?.focus();
              };
              panel.addEventListener('keydown', onKey);
              onCleanup(() => panel.removeEventListener('keydown', onKey));
            }}
          >
            <TreeView tree={this.tree} lines={this.options.lines ?? false} aria-label={this.label.replace(/:\s*$/, '')} />
          </div>
        </If>
      </div>
    );
  }

  private clear(): void {
    this.setValue(null);
    this.changed();
  }
}
