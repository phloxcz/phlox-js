import { batch, state, untrack } from "../reactive/reactive.js";
import { texts } from "../ui/texts.js";
// src/components/tree.ts
/**
* The tree: nodes, their expansion, the selected node, checked nodes and moving, like phloxcz/components-tree.
* This is the model, <TreeView> draws it. Nodes come all at once (`nodes`) or level by level (`load`).
*/
/** One node in the tree, with its state. */
var TreeItem = class {
	node;
	/** Null until the children are loaded. */
	children = state(null);
	expanded = state(false);
	loading = state(false);
	parent;
	/** The element of the node while it is shown, for the focus. */
	element = null;
	constructor(node, parent) {
		this.node = node;
		this.parent = state(parent);
	}
	get id() {
		return this.node.id;
	}
	hasChildren() {
		const children = this.children();
		return children ? children.length > 0 : Boolean(this.node.hasChildren || this.node.children?.length);
	}
	/** Parents from the top level down to the direct one. */
	ancestors() {
		const ancestors = [];
		for (let parent = this.parent(); parent; parent = parent.parent()) ancestors.unshift(parent);
		return ancestors;
	}
	/** Whether this node is inside the other one, at any depth. */
	isInside(other) {
		return this.ancestors().includes(other);
	}
};
var Tree = class {
	options;
	static texts = texts("tree", {
		expand: "Expand",
		collapse: "Collapse",
		loading: "Loading…"
	});
	roots = state([]);
	/** The selected node, e.g. the one the page shows. */
	selected = state(null);
	/** Picked nodes with `pick`. */
	checked = state([]);
	/** Picking is off: 'disabled' greys the boxes out, 'readonly' only keeps them as they are (a control of a form). */
	locked = state(false);
	/** Called when the user selects a node, not when select() is called from code. */
	onSelect = null;
	loaded = null;
	constructor(options = {}) {
		this.options = options;
		if (options.nodes) {
			this.roots.set(this.build(options.nodes, null));
			this.loaded = this.restore(untrack(this.roots));
		}
	}
	/** Loads the top level, once. Await it in startup() when the tree must be ready, e.g. for select(). */
	load() {
		this.loaded ??= this.reload();
		return this.loaded;
	}
	/** Loads the tree again, e.g. after a change on the server. Remembered nodes are expanded again. */
	async reload() {
		const nodes = this.options.load ? await this.options.load(null) : this.options.nodes ?? [];
		const roots = this.build(nodes, null);
		this.roots.set(roots);
		await this.restore(roots);
	}
	/** A loaded node by its id. */
	find(id) {
		const search = (items) => {
			for (const item of items) {
				if (item.id === id) return item;
				const found = search(untrack(item.children) ?? []);
				if (found) return found;
			}
		};
		return search(untrack(this.roots));
	}
	/** Nodes the user can see, from the top down: expanded nodes show their children. */
	visible() {
		const list = [];
		const walk = (items) => {
			for (const item of items) {
				list.push(item);
				if (item.expanded()) walk(item.children() ?? []);
			}
		};
		walk(this.roots());
		return list;
	}
	async expand(item) {
		if (!item.hasChildren()) return;
		const fresh = !untrack(item.children);
		await this.loadChildren(item);
		item.expanded.set(true);
		if (fresh) await this.restore(untrack(item.children) ?? []);
		this.save();
	}
	collapse(item) {
		item.expanded.set(false);
		this.save();
	}
	toggle(item) {
		if (untrack(item.expanded)) {
			this.collapse(item);
			return Promise.resolve();
		}
		return this.expand(item);
	}
	/** Expands the ancestors of a node, loading them with `path` when needed. Returns the node, or null. */
	async reveal(id) {
		await this.load();
		let item = this.find(id);
		if (!item && this.options.path) {
			for (const ancestor of await this.options.path(id)) {
				const parent = this.find(ancestor);
				if (parent) await this.loadChildren(parent);
			}
			item = this.find(id);
		}
		if (!item) return null;
		for (const ancestor of item.ancestors()) await this.expand(ancestor);
		return item;
	}
	/** Selects a node from code, e.g. by the id from the URL, and shows it. Null clears the selection. */
	async select(id) {
		this.selected.set(id);
		if (id !== null) await this.reveal(id);
	}
	/** The user selected a node. */
	choose(item) {
		if (item.node.disabled) return;
		this.selected.set(item.id);
		this.onSelect?.(item.node);
	}
	/** Picks or unpicks a node, with `pick`. */
	check(item, on = !untrack(this.checked).includes(item.id)) {
		if (item.node.disabled || untrack(this.locked)) return;
		if (this.options.pick === "single") this.checked.set(on ? [item.id] : []);
		else this.checked.update((ids) => on ? [...ids.filter((id) => id !== item.id), item.id] : ids.filter((id) => id !== item.id));
	}
	canDrag(item) {
		const { draggable } = this.options;
		if (item.node.disabled || !draggable) return false;
		return draggable === true || draggable(item.node);
	}
	/** Whether a node can go there: not onto itself, not into its own subtree, not into its own parent again. */
	canDrop(item, target, position) {
		if (target === item || target.isInside(item)) return false;
		if (position === "child") return !target.node.disabled && target !== untrack(item.parent);
		return true;
	}
	/**
	* Moves a node, as dragging does. Calls the `move` option; when it fails, the node goes back and the error
	* is thrown on. Returns false when the node did not move (the same place, or not allowed).
	*/
	async move(item, target, position) {
		if (!this.canDrop(item, target, position)) return false;
		const from = {
			parent: untrack(item.parent),
			index: this.siblings(untrack(item.parent)).indexOf(item)
		};
		const parent = position === "child" ? target : untrack(target.parent);
		if (position === "child") await this.loadChildren(target);
		const others = this.siblings(parent).filter((other) => other !== item);
		const index = position === "child" ? others.length : others.indexOf(target) + (position === "after" ? 1 : 0);
		if (parent === from.parent && index === from.index) return false;
		this.place(item, parent, index);
		if (position === "child") target.expanded.set(true);
		try {
			await this.options.move?.({
				node: item.node,
				target: target.node,
				position,
				parent: parent?.node ?? null,
				index
			});
		} catch (error) {
			this.place(item, from.parent, from.index);
			throw error;
		}
		return true;
	}
	build(nodes, parent) {
		return nodes.map((node) => {
			const item = new TreeItem(node, parent);
			if (node.children || !this.options.load) item.children.set(this.build(node.children ?? [], item));
			return item;
		});
	}
	async loadChildren(item) {
		if (untrack(item.children)) return;
		if (!this.options.load || !item.node.hasChildren) {
			item.children.set([]);
			return;
		}
		item.loading.set(true);
		try {
			item.children.set(this.build(await this.options.load(item.node), item));
		} finally {
			item.loading.set(false);
		}
	}
	siblings(parent) {
		return (parent ? untrack(parent.children) : untrack(this.roots)) ?? [];
	}
	/** Takes a node from where it is and puts it under the parent at the index. */
	place(item, parent, index) {
		const listOf = (owner) => owner ? owner.children : this.roots;
		batch(() => {
			listOf(untrack(item.parent)).update((items) => items.filter((other) => other !== item));
			listOf(parent).update((items) => [
				...items.slice(0, index),
				item,
				...items.slice(index)
			]);
			item.parent.set(parent);
		});
	}
	storageKey() {
		return this.options.remember ? `phlox-tree:${this.options.remember}` : null;
	}
	remembered() {
		const key = this.storageKey();
		if (!key) return /* @__PURE__ */ new Set();
		try {
			return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
		} catch {
			return /* @__PURE__ */ new Set();
		}
	}
	save() {
		const key = this.storageKey();
		if (!key) return;
		const expanded = [];
		const walk = (items) => {
			for (const item of items) {
				if (untrack(item.expanded)) expanded.push(item.id);
				walk(untrack(item.children) ?? []);
			}
		};
		walk(untrack(this.roots));
		const kept = [...this.remembered()].filter((id) => !this.find(id));
		try {
			localStorage.setItem(key, JSON.stringify([...kept, ...expanded]));
		} catch {}
	}
	async restore(items) {
		const remembered = this.remembered();
		if (!remembered.size) return;
		const expand = async (level) => {
			await Promise.all(level.filter((item) => remembered.has(item.id)).map(async (item) => {
				await this.loadChildren(item);
				if (item.hasChildren()) item.expanded.set(true);
				await expand(untrack(item.children) ?? []);
			}));
		};
		await expand(items);
	}
};
export { Tree, TreeItem };
