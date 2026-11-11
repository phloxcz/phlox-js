/**
 * Picking from a tree in a form, like the picker of phloxcz/components-tree: every node has a radio button
 * (addTreeSelect, one id or null) or a checkbox (addTreeMultiSelect, a list of ids). The tree is shown inline.
 */

import { effect, untrack } from '../reactive/reactive';
import type { Child } from '../ui/dom';
import { classes, currentTheme } from '../ui/theme';
import { Tree } from '../components/tree';
import type { TreeKey, TreeNode, TreeOptions } from '../components/tree';
import { TreeView } from '../components/treeview';
import { FormControl } from './controls';
import type { ExtraAttributes } from './controls';

export interface TreeSelectOptions<K extends TreeKey> extends Omit<TreeOptions<TreeNode<K>>, 'pick' | 'draggable' | 'move'> {
  /** Connecting lines between nodes. */
  lines?: boolean;
}

/** One node (K | null) or several (K[]). Picked nodes deep in a lazy tree are shown with the `path` option. */
export class TreeSelect<K extends TreeKey, T extends K | null | K[]> extends FormControl<T> {
  readonly tree: Tree<TreeNode<K>>;

  constructor(label = '', readonly options: TreeSelectOptions<K> = {}, readonly multiple = false) {
    super(label);
    this.tree = new Tree<TreeNode<K>>({ ...options, pick: multiple ? 'multiple' : 'single' });
  }

  getValue(): T {
    const ids = this.tree.checked();
    return (this.multiple ? ids : (ids[0] ?? null)) as T;
  }

  setValue(value: T): void {
    const ids = value === null || value === undefined ? [] : Array.isArray(value) ? [...value] : [value as K];
    this.tree.checked.set(ids);
    // Picked nodes are shown, also those deep in the tree
    for (const id of ids) void this.tree.reveal(id).catch(() => {});
  }

  isFilled(): boolean {
    return this.tree.checked().length > 0;
  }

  render(attributes: ExtraAttributes): Child {
    const { id, name, ref, onBlur, required: _required, disabled: _disabled, ...common } = this.attrs();
    const theme = currentTheme();
    let wrapper: HTMLElement;
    // Picking is a change: after the first error or after leaving the tree, it is checked live
    let first = true;
    effect(() => {
      this.tree.checked();
      if (first) first = false;
      else untrack(() => this.changed());
    });
    return (
      <div
        class={() => classes('phlox-treeselect', theme.class('treeselect'), this.hasErrors() && theme.class('invalid'), attributes.class as string)}
        ref={element => { wrapper = element; }}
        onFocusout={event => {
          if (wrapper.contains(event.relatedTarget as Node | null)) return;
          (onBlur as (event: FocusEvent) => void)(event);
        }}
      >
        <TreeView
          tree={this.tree}
          lines={this.options.lines ?? false}
          name={name as string}
          aria-label={this.label.replace(/:\s*$/, '')}
          attributes={{ ...common, id, ref }}
        />
      </div>
    );
  }
}
