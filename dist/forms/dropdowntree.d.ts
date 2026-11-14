/**
 * One node of a tree in a drop-down, like a DropDownList whose items are a tree. Closed it shows the way
 * from the top to the picked node, "Domácnost › Kuchyně › Nože"; open it shows the tree in a panel.
 */
import type { Child } from '../ui/dom';
import { Tree } from '../components/tree';
import type { TreeItem, TreeKey, TreeNode } from '../components/tree';
import { FormControl } from './controls';
import type { ExtraAttributes } from './controls';
import type { TreeSelectOptions } from './treeselect';
export interface DropDownTreeSelectOptions<K extends TreeKey> extends TreeSelectOptions<K> {
    /** Shown while nothing is picked. */
    placeholder?: string;
    /** Between the names in the way to the picked node. */
    separator?: string;
}
export declare class DropDownTreeSelect<K extends TreeKey> extends FormControl<K | null> {
    readonly options: DropDownTreeSelectOptions<K>;
    static texts: {
        clear: string;
    };
    readonly tree: Tree<TreeNode<K>>;
    /** The picked id, the value of the control. */
    private readonly picked;
    readonly opened: import("..").State<boolean>;
    /** True while the way to a node set from code is being loaded. */
    readonly loading: import("..").State<boolean>;
    private readonly panelId;
    /** Nodes from the top down to the picked one, as far as they are loaded. Follows the tree, also a reload. */
    readonly path: import("..").Accessor<TreeItem<TreeNode<K>>[]>;
    constructor(label?: string, options?: DropDownTreeSelectOptions<K>);
    getValue(): K | null;
    setValue(value: K | null): void;
    isFilled(): boolean;
    open(): void;
    close(): void;
    /** The text of the button: the way to the picked node. */
    private text;
    render(attributes: ExtraAttributes): Child;
    private clear;
}
