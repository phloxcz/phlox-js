/**
 * The tree: nodes, their expansion, the selected node, checked nodes and moving, like phloxcz/components-tree.
 * This is the model, <TreeView> draws it. Nodes come all at once (`nodes`) or level by level (`load`).
 */
import type { State } from '../reactive/reactive';
export type TreeKey = string | number;
/** A node as the application gives it. More fields can be added, the tree passes the node on unchanged. */
export interface TreeNode<K extends TreeKey = TreeKey> {
    id: K;
    label: string;
    /** Children given at once. With `load` they are optional, a node without them is loaded when expanded. */
    children?: TreeNode<K>[];
    /** With `load`: whether the node has children to load, so it can be expanded. */
    hasChildren?: boolean;
    /** Cannot be selected, checked or dragged. */
    disabled?: boolean;
}
/** Where a dragged node goes: in front of the target, behind it, or as its last child. */
export type TreePosition = 'before' | 'after' | 'child';
export interface TreeMove<N> {
    node: N;
    target: N;
    position: TreePosition;
    /** The new parent, null for the top level, and the new position among its children. */
    parent: N | null;
    index: number;
}
export interface TreeOptions<N extends TreeNode<any>> {
    /** The whole tree at once. */
    nodes?: N[];
    /** Children of a node, or the top level for null, typically from the server. Called when a node is expanded. */
    load?: (parent: N | null) => Promise<N[]>;
    /** Ids of the ancestors of a node from the top, so a node not loaded yet can be shown (select, reveal). */
    path?: (id: N['id']) => Promise<N['id'][]>;
    /** Remembers expanded nodes in the browser under this key, across page loads. */
    remember?: string;
    /** Nodes can be moved by dragging. A function says which ones. */
    draggable?: boolean | ((node: N) => boolean);
    /**
     * Called after a node was moved by dragging, typically to save it on the server.
     * When it fails, the node goes back to its place and the error goes on.
     */
    move?: (move: TreeMove<N>) => void | Promise<void>;
    /** Nodes are picked with a radio button or checkboxes, see checked. */
    pick?: 'single' | 'multiple';
}
/** One node in the tree, with its state. */
export declare class TreeItem<N extends TreeNode<any>> {
    readonly node: N;
    /** Null until the children are loaded. */
    readonly children: State<TreeItem<N>[] | null>;
    readonly expanded: State<boolean>;
    readonly loading: State<boolean>;
    readonly parent: State<TreeItem<N> | null>;
    /** The element of the node while it is shown, for the focus. */
    element: HTMLElement | null;
    constructor(node: N, parent: TreeItem<N> | null);
    get id(): N['id'];
    hasChildren(): boolean;
    /** Parents from the top level down to the direct one. */
    ancestors(): TreeItem<N>[];
    /** Whether this node is inside the other one, at any depth. */
    isInside(other: TreeItem<N>): boolean;
}
export declare class Tree<N extends TreeNode<any> = TreeNode> {
    readonly options: TreeOptions<N>;
    static texts: {
        expand: string;
        collapse: string;
        loading: string;
    };
    readonly roots: State<TreeItem<N>[]>;
    /** The selected node, e.g. the one the page shows. */
    readonly selected: State<N["id"] | null>;
    /** Picked nodes with `pick`. */
    readonly checked: State<N["id"][]>;
    /** Called when the user selects a node, not when select() is called from code. */
    onSelect: ((node: N) => void) | null;
    private loaded;
    constructor(options?: TreeOptions<N>);
    /** Loads the top level, once. Await it in startup() when the tree must be ready, e.g. for select(). */
    load(): Promise<void>;
    /** Loads the tree again, e.g. after a change on the server. Remembered nodes are expanded again. */
    reload(): Promise<void>;
    /** A loaded node by its id. */
    find(id: N['id']): TreeItem<N> | undefined;
    /** Nodes the user can see, from the top down: expanded nodes show their children. */
    visible(): TreeItem<N>[];
    expand(item: TreeItem<N>): Promise<void>;
    collapse(item: TreeItem<N>): void;
    toggle(item: TreeItem<N>): Promise<void>;
    /** Expands the ancestors of a node, loading them with `path` when needed. Returns the node, or null. */
    reveal(id: N['id']): Promise<TreeItem<N> | null>;
    /** Selects a node from code, e.g. by the id from the URL, and shows it. Null clears the selection. */
    select(id: N['id'] | null): Promise<void>;
    /** The user selected a node. */
    choose(item: TreeItem<N>): void;
    /** Picks or unpicks a node, with `pick`. */
    check(item: TreeItem<N>, on?: boolean): void;
    canDrag(item: TreeItem<N>): boolean;
    /** Whether a node can go there: not onto itself, not into its own subtree, not into its own parent again. */
    canDrop(item: TreeItem<N>, target: TreeItem<N>, position: TreePosition): boolean;
    /**
     * Moves a node, as dragging does. Calls the `move` option; when it fails, the node goes back and the error
     * is thrown on. Returns false when the node did not move (the same place, or not allowed).
     */
    move(item: TreeItem<N>, target: TreeItem<N>, position: TreePosition): Promise<boolean>;
    private build;
    private loadChildren;
    private siblings;
    /** Takes a node from where it is and puts it under the parent at the index. */
    private place;
    private storageKey;
    private remembered;
    private save;
    private restore;
}
