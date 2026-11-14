import { Scope, computed, effect, state, untrack } from "../reactive/reactive.js";
import { insert, templateOf, withNamespaceOf } from "./dom.js";
// src/ui/flow.ts
/** Control flow in templates: If with ElseIf and Else, and For. */
/**
* Shows the first branch whose condition is truthy:
*
*   <If when={user}> ... <ElseIf when={loading} /> ... <Else /> ... </If>
*
* Only the shown branch is created and inserted. A hidden one is removed and cleaned up,
* and it is rebuilt only when another branch takes over, not with every change of the value.
*/
function If(props) {
	const children = Array.isArray(props.children) ? props.children : [props.children];
	const branches = [{
		when: props.when,
		content: []
	}];
	for (const child of children) {
		const template = templateOf(child);
		const last = branches.at(-1);
		if (template?.tag === Else || template?.tag === ElseIf) {
			if (!last.when) throw new Error("<Else /> must be the last branch of <If>.");
			const when = template.tag === ElseIf ? template.props.when : null;
			branches.push({
				when,
				content: []
			});
		} else if (branches.length === 1 && typeof child === "function" && !template) {
			const withValue = child;
			last.content.push(() => withValue(props.when));
		} else last.content.push(child);
	}
	const shown = computed(() => branches.find((branch) => !branch.when || branch.when()));
	return () => shown()?.content;
}
/** Starts the branch of <If> shown when no condition above is truthy. Like {else} in Latte. */
function Else() {
	throw new Error("<Else /> can be used only directly inside <If>.");
}
/** Starts another conditional branch of <If>. Like {elseif} in Latte. */
function ElseIf(_props) {
	throw new Error("<ElseIf /> can be used only directly inside <If>.");
}
/**
* Longest increasing subsequence of old row positions, returned as new positions.
* These rows already are in the right order, so only the others have to move. -1 is a new row.
*/
function stablePositions(previous) {
	const tails = [];
	const before = [];
	previous.forEach((value, position) => {
		if (value < 0) return;
		let low = 0;
		let high = tails.length;
		while (low < high) {
			const middle = low + high >> 1;
			if (previous[tails[middle]] < value) low = middle + 1;
			else high = middle;
		}
		before[position] = low > 0 ? tails[low - 1] : -1;
		tails[low] = position;
	});
	const stable = /* @__PURE__ */ new Set();
	for (let position = tails.at(-1) ?? -1; position >= 0; position = before[position]) stable.add(position);
	return stable;
}
function For(props) {
	const owner = new Scope();
	const fragment = document.createDocumentFragment();
	const end = fragment.appendChild(document.createComment(""));
	let rows = [];
	const createRow = (item, key, position) => {
		const scope = new Scope(owner);
		const index = state(position);
		const current = props.key ? state(item) : null;
		const content = document.createDocumentFragment();
		scope.run(() => insert(content, props.children(current ?? item, index), null));
		if (content.childNodes.length !== 1) {
			content.insertBefore(document.createComment(""), content.firstChild);
			content.appendChild(document.createComment(""));
		}
		return {
			key,
			scope,
			index,
			item: current,
			first: content.firstChild,
			last: content.lastChild,
			pending: content
		};
	};
	const nodesOf = (row) => {
		const nodes = [];
		for (let node = row.first;; node = node.nextSibling) {
			nodes.push(node);
			if (node === row.last) return nodes;
		}
	};
	const update = (items) => {
		const available = /* @__PURE__ */ new Map();
		for (const row of rows) {
			const same = available.get(row.key);
			if (same) same.push(row);
			else available.set(row.key, [row]);
		}
		const previous = [];
		const next = items.map((item, position) => {
			const key = props.key ? props.key(item) : item;
			const row = available.get(key)?.shift();
			previous.push(row ? row.index() : -1);
			if (!row) return createRow(item, key, position);
			row.index.set(position);
			row.item?.set(item);
			return row;
		});
		const parent = end.parentNode;
		for (const unused of available.values()) for (const row of unused) {
			row.scope.dispose();
			for (const node of nodesOf(row)) parent.removeChild(node);
		}
		const stable = stablePositions(previous);
		let anchor = end;
		for (let position = next.length - 1; position >= 0; position--) {
			const row = next[position];
			if (row.pending) {
				parent.insertBefore(row.pending, anchor);
				row.pending = null;
			} else if (!stable.has(position)) for (const node of nodesOf(row)) parent.insertBefore(node, anchor);
			anchor = row.first;
		}
		rows = next;
	};
	effect(() => {
		const items = props.each();
		untrack(() => withNamespaceOf(end.parentNode, () => update(items)));
	});
	return fragment;
}
export { Else, ElseIf, For, If };
