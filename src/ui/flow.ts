/** Control flow in templates: If with ElseIf and Else, and For. */

import { Scope, computed, effect, state, untrack } from '../reactive/reactive';
import type { Accessor, State } from '../reactive/reactive';
import { insert, templateOf } from './dom';
import type { Child } from './dom';

type Truthy<T> = Exclude<T, null | undefined | false | 0 | ''>;

/** Like Child, but a function in the first branch may take the value of `when`. */
type IfChild<T> =
  | Node | string | number | boolean | null | undefined
  | ((value: Accessor<Truthy<T>>) => Child)
  | IfChild<T>[];

interface Branch {
  /** null is the Else branch. */
  when: Accessor<unknown> | null;
  content: Child[];
}

/**
 * Shows the first branch whose condition is truthy:
 *
 *   <If when={user}> ... <ElseIf when={loading} /> ... <Else /> ... </If>
 *
 * Only the shown branch is created and inserted. A hidden one is removed and cleaned up,
 * and it is rebuilt only when another branch takes over, not with every change of the value.
 */
export function If<T>(props: { when: Accessor<T>; children?: IfChild<T> }): Child {
  const children = (Array.isArray(props.children) ? props.children : [props.children]) as Child[];
  const branches: Branch[] = [{ when: props.when, content: [] }];

  for (const child of children) {
    const template = templateOf(child);
    const last = branches.at(-1)!;
    if (template?.tag === Else || template?.tag === ElseIf) {
      if (!last.when) throw new Error('<Else /> must be the last branch of <If>.');
      const when = template.tag === ElseIf ? (template.props as { when: Accessor<unknown> }).when : null;
      branches.push({ when, content: [] });
    } else if (branches.length === 1 && typeof child === 'function' && !template) {
      const withValue = child as (value: Accessor<T>) => Child;
      last.content.push(() => withValue(props.when));
    } else {
      last.content.push(child);
    }
  }

  const shown = computed(() => branches.find(branch => !branch.when || branch.when()));
  return () => shown()?.content;
}

/** Starts the branch of <If> shown when no condition above is truthy. Like {else} in Latte. */
export function Else(): Child {
  throw new Error('<Else /> can be used only directly inside <If>.');
}

/** Starts another conditional branch of <If>. Like {elseif} in Latte. */
export function ElseIf(_props: { when: Accessor<unknown> }): Child {
  throw new Error('<ElseIf /> can be used only directly inside <If>.');
}

/**
 * Longest increasing subsequence of old row positions, returned as new positions.
 * These rows already are in the right order, so only the others have to move. -1 is a new row.
 */
function stablePositions(previous: number[]): Set<number> {
  const tails: number[] = [];
  const before: number[] = [];
  previous.forEach((value, position) => {
    if (value < 0) return;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (previous[tails[middle]!]! < value) low = middle + 1;
      else high = middle;
    }
    before[position] = low > 0 ? tails[low - 1]! : -1;
    tails[low] = position;
  });

  const stable = new Set<number>();
  for (let position = tails.at(-1) ?? -1; position >= 0; position = before[position]!) stable.add(position);
  return stable;
}

interface Row<T> {
  key: unknown;
  scope: Scope;
  index: State<number>;
  item: State<T> | null;
  first: Node;
  last: Node;
  /** Holds the nodes of a new row until it is placed. */
  pending: DocumentFragment | null;
}

/** Without `key` a row belongs to its item (compared by identity) and receives it as a plain value. */
export function For<T>(props: {
  each: Accessor<readonly T[]>;
  key?: undefined;
  children: (item: T, index: Accessor<number>) => Child;
}): Child;
/** With `key` a row survives a new object with the same key and receives the item as an accessor. */
export function For<T>(props: {
  each: Accessor<readonly T[]>;
  key: (item: T) => unknown;
  children: (item: Accessor<T>, index: Accessor<number>) => Child;
}): Child;
export function For<T>(props: {
  each: Accessor<readonly T[]>;
  key?: ((item: T) => unknown) | undefined;
  children: (item: any, index: Accessor<number>) => Child;
}): Child {
  const owner = new Scope();
  const fragment = document.createDocumentFragment();
  const end = fragment.appendChild(document.createComment(''));
  let rows: Row<T>[] = [];

  const createRow = (item: T, key: unknown, position: number): Row<T> => {
    const scope = new Scope(owner);
    const index = state(position);
    const current = props.key ? state(item) : null;
    const content = document.createDocumentFragment();
    scope.run(() => insert(content, props.children(current ?? item, index), null));
    // A single node stays a single node, anything else can grow and needs markers
    if (content.childNodes.length !== 1) {
      content.insertBefore(document.createComment(''), content.firstChild);
      content.appendChild(document.createComment(''));
    }
    return { key, scope, index, item: current, first: content.firstChild!, last: content.lastChild!, pending: content };
  };

  const nodesOf = (row: Row<T>): Node[] => {
    const nodes: Node[] = [];
    for (let node: Node = row.first; ; node = node.nextSibling!) {
      nodes.push(node);
      if (node === row.last) return nodes;
    }
  };

  const update = (items: readonly T[]): void => {
    const available = new Map<unknown, Row<T>[]>();
    for (const row of rows) {
      const same = available.get(row.key);
      if (same) same.push(row);
      else available.set(row.key, [row]);
    }

    const previous: number[] = [];
    const next = items.map((item, position) => {
      const key = props.key ? props.key(item) : item;
      const row = available.get(key)?.shift();
      previous.push(row ? row.index() : -1);
      if (!row) return createRow(item, key, position);
      row.index.set(position);
      row.item?.set(item);
      return row;
    });

    const parent = end.parentNode!;
    for (const unused of available.values()) {
      for (const row of unused) {
        row.scope.dispose();
        for (const node of nodesOf(row)) parent.removeChild(node);
      }
    }

    // From the end, every row is placed in front of the one after it. Stable rows are not touched,
    // a moved node would lose focus, scroll position or a running animation.
    const stable = stablePositions(previous);
    let anchor: Node = end;
    for (let position = next.length - 1; position >= 0; position--) {
      const row = next[position]!;
      if (row.pending) {
        parent.insertBefore(row.pending, anchor);
        row.pending = null;
      } else if (!stable.has(position)) {
        for (const node of nodesOf(row)) parent.insertBefore(node, anchor);
      }
      anchor = row.first;
    }
    rows = next;
  };

  effect(() => {
    const items = props.each();
    untrack(() => update(items));
  });

  return fragment;
}
