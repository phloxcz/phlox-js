/**
 * Picking from a tree in a form, like the picker of phloxcz/components-tree: every node has a radio button
 * (addTreeSelect, one id or null) or a checkbox (addTreeMultiSelect, a list of ids). The tree is shown inline.
 */
import type { Child } from '../ui/dom';
import { Tree } from '../components/tree';
import type { TreeKey, TreeNode, TreeOptions } from '../components/tree';
import { FormControl } from './controls';
import type { ExtraAttributes } from './controls';
export interface TreeSelectOptions<K extends TreeKey> extends Omit<TreeOptions<TreeNode<K>>, 'pick' | 'draggable' | 'move'> {
    /** Connecting lines between nodes. */
    lines?: boolean;
}
/** One node (K | null) or several (K[]). Picked nodes deep in a lazy tree are shown with the `path` option. */
export declare class TreeSelect<K extends TreeKey, T extends K | null | K[]> extends FormControl<T> {
    readonly options: TreeSelectOptions<K>;
    readonly multiple: boolean;
    readonly tree: Tree<TreeNode<K>>;
    constructor(label?: string, options?: TreeSelectOptions<K>, multiple?: boolean);
    getValue(): T;
    setValue(value: T): void;
    isFilled(): boolean;
    render(attributes: ExtraAttributes): Child;
}
