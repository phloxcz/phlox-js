/**
 * Drawing of a Tree, with the HTML and classes of phloxcz/components-tree, the keyboard of the WAI-ARIA tree
 * pattern, and moving of nodes by dragging (pointer events, so also with a pen; on a touch screen a swipe scrolls).
 */
import type { Child } from '../ui/dom';
import { Tree, TreeItem } from './tree';
import type { TreeNode } from './tree';
export interface TreeViewProps<N extends TreeNode<any>> {
    tree: Tree<N>;
    /** Connecting lines between nodes. */
    lines?: boolean;
    /** A link for every node: the label becomes <a>, and selecting a node goes there. */
    href?: (node: N) => string;
    /** An icon in front of the label. */
    icon?: (node: N, item: TreeItem<N>) => Child;
    /** The label, the text of the node by default. */
    label?: (node: N) => Child;
    /** For readers of the screen: what the tree is. */
    'aria-label'?: string;
    class?: string;
    /** With `pick`: the name of the radio buttons or checkboxes. */
    name?: string;
    /** Attributes of the element with role="tree", e.g. from a form control. */
    attributes?: Record<string, unknown>;
}
export declare function TreeView<N extends TreeNode<any>>(props: TreeViewProps<N>): Child;
