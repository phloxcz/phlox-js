/**
 * Drawing of a Tree, with the HTML and classes of phloxcz/components-tree, the keyboard of the WAI-ARIA tree
 * pattern, and moving of nodes by dragging (pointer events, so also with a pen; on a touch screen a swipe scrolls).
 */

import { For, If, Else } from '../ui/flow';
import { computed, effect, getScope, state, untrack } from '../reactive/reactive';
import type { Child } from '../ui/dom';
import { APP } from '../ui/component';
import { classes, currentTheme } from '../ui/theme';
import { followPointer } from '../ui/drag';
import { allowsMotion } from '../ui/motion';
import type { Point } from '../ui/drag';
import type { Application } from '../application/application';
import { foldText } from '../forms/listbox';
import { Tree, TreeItem } from './tree';
import type { TreeNode, TreePosition } from './tree';

const TOGGLE_ICON = '<svg class="pt-toggle__icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** The pointer must move this far before a press becomes dragging, so a click stays a click. */
const DRAG_THRESHOLD = 4;
/** How long a collapsed node waits under a dragged one before it opens. */
const OPEN_DELAY = 600;
/** Where the copy of a dragged row is, from the pointer. */
const GHOST_OFFSET = { x: 14, y: 10 };
/** A finger must stay this long and move less than this to start dragging; otherwise it scrolls. */
const HOLD_DELAY = 400;
const HOLD_TOLERANCE = 8;

const noMenu = (event: Event): void => event.preventDefault();

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

export function TreeView<N extends TreeNode<any>>(props: TreeViewProps<N>): Child {
  const { tree } = props;
  const theme = currentTheme();
  const slot = (part: string) => theme.class(`tree.${part}`);
  const app = getScope()?.find<Application>(APP);
  const fail = (error: unknown) => (app ? app.onError(error) : console.error(error));
  const pick = tree.options.pick;
  const items = new WeakMap<Element, TreeItem<N>>();

  void tree.load().catch(fail);

  // Only one node can be reached by Tab, the arrows go on from it (a roving tabindex)
  const focused = state<TreeItem<N> | null>(null);
  const tabStop = computed(() => {
    const visible = tree.visible();
    const current = focused();
    if (current && visible.includes(current)) return current;
    return visible.find(item => item.id === tree.selected() || (pick && tree.checked().includes(item.id))) ?? visible[0] ?? null;
  });
  const focus = (item: TreeItem<N> | undefined | null): void => {
    if (!item) return;
    focused.set(item);
    item.element?.focus();
  };

  /** What a click or Enter on a node does: picks it, or selects it and follows its link. */
  const activate = (item: TreeItem<N>, viaLink = false): void => {
    if (item.node.disabled) return;
    if (pick) return tree.check(item);
    tree.choose(item);
    if (props.href && !viaLink) item.element?.querySelector<HTMLAnchorElement>(':scope > .pt-row > a.pt-label')?.click();
  };

  // Type-ahead: letters typed quickly one after another find the next node starting with them
  let typed = '';
  let typedAt = 0;
  const typeAhead = (char: string, from: TreeItem<N>): void => {
    typed = Date.now() - typedAt > 500 ? char : typed + char;
    typedAt = Date.now();
    const visible = tree.visible();
    const start = visible.indexOf(from);
    const order = [...visible.slice(start + (typed.length === 1 ? 1 : 0)), ...visible.slice(0, start)];
    focus(order.find(item => foldText(item.node.label).startsWith(foldText(typed))));
  };

  const onKeydown = (event: KeyboardEvent): void => {
    const item = items.get((event.target as Element).closest('.pt-item')!);
    if (!item || event.altKey || event.ctrlKey || event.metaKey) return;
    const visible = tree.visible();
    const at = visible.indexOf(item);
    const handled = (): void => event.preventDefault();
    switch (event.key) {
      case 'ArrowDown': handled(); focus(visible[at + 1]); break;
      case 'ArrowUp': handled(); focus(visible[at - 1]); break;
      case 'Home': handled(); focus(visible[0]); break;
      case 'End': handled(); focus(visible.at(-1)); break;
      case 'ArrowRight':
        handled();
        if (!item.hasChildren()) break;
        if (untrack(item.expanded)) focus(untrack(item.children)?.[0]);
        else void tree.expand(item).catch(fail);
        break;
      case 'ArrowLeft':
        handled();
        if (untrack(item.expanded)) tree.collapse(item);
        else focus(untrack(item.parent));
        break;
      case 'Enter':
      case ' ':
        handled();
        activate(item);
        break;
      case '*':
        // Expands all siblings, as in the WAI-ARIA pattern
        handled();
        for (const sibling of (untrack(item.parent) ? untrack(untrack(item.parent)!.children) : untrack(tree.roots)) ?? []) {
          void tree.expand(sibling).catch(fail);
        }
        break;
      default:
        if (event.key.length === 1 && event.key.trim()) {
          handled();
          typeAhead(event.key, item);
        }
    }
  };

  // Dragging: where the dragged node would go
  const dragged = state<TreeItem<N> | null>(null);
  const drop = state<{ item: TreeItem<N>; position: TreePosition } | null>(null);
  let root: HTMLElement;

  const startDrag = (event: PointerEvent, item: TreeItem<N>, row: HTMLElement): void => {
    if (event.button !== 0 || !tree.canDrag(item)) return;
    // A finger drags only after it is held still for a moment, a swipe scrolls the page as usual
    if (event.pointerType === 'touch') holdToDrag(event, item, row);
    else dragFrom(event, item, row);
  };

  const holdToDrag = (event: PointerEvent, item: TreeItem<N>, row: HTMLElement): void => {
    const pointer = event.pointerId;
    const stop = (): void => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('contextmenu', noMenu, true);
    };
    const onMove = (move: PointerEvent): void => {
      if (move.pointerId === pointer && Math.hypot(move.clientX - event.clientX, move.clientY - event.clientY) > HOLD_TOLERANCE) stop();
    };
    const onEnd = (end: PointerEvent): void => {
      if (end.pointerId === pointer) stop();
    };
    const timer = setTimeout(() => {
      stop();
      navigator.vibrate?.(15);
      dragFrom(event, item, row, true);
    }, HOLD_DELAY);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    // A held finger would open the menu of the browser
    window.addEventListener('contextmenu', noMenu, true);
  };

  const dragFrom = (event: PointerEvent, item: TreeItem<N>, row: HTMLElement, touch = false): void => {
    const start: Point = { x: event.clientX, y: event.clientY };
    const box = row.getBoundingClientRect();
    let ghost: HTMLElement | null = null;
    let opening: { item: TreeItem<N>; timer: ReturnType<typeof setTimeout> } | null = null;
    const stopOpening = (): void => {
      if (opening) clearTimeout(opening.timer);
      opening = null;
    };

    const move = (pointer: Point): void => {
      if (!ghost) {
        if (!touch && Math.hypot(pointer.x - start.x, pointer.y - start.y) < DRAG_THRESHOLD) return;
        // A copy of the row follows the pointer, the node itself stays in place, faded
        ghost = document.createElement('div');
        ghost.className = 'phlox-tree pt-ghost';
        ghost.style.maxWidth = `${box.width}px`;
        ghost.append(row.cloneNode(true));
        document.body.append(ghost);
        dragged.set(item);
      }
      // Beside the pointer, not over the row under it, so the place where the node goes stays visible
      ghost.style.transform = `translate(${pointer.x + GHOST_OFFSET.x}px, ${pointer.y + GHOST_OFFSET.y}px)`;

      const element = document.elementFromPoint?.(pointer.x, pointer.y)?.closest('.pt-item');
      const target = element && root.contains(element) ? items.get(element) : undefined;
      if (!target) {
        drop.set(null);
        return stopOpening();
      }
      const targetRow = target.element!.querySelector(':scope > .pt-row')!.getBoundingClientRect();
      const share = (pointer.y - targetRow.top) / targetRow.height;
      const position: TreePosition = share < 0.28 ? 'before' : share > 0.72 ? 'after' : 'child';
      const current = untrack(drop);
      if (current?.item !== target || current.position !== position) {
        drop.set(tree.canDrop(item, target, position) ? { item: target, position } : null);
      }
      // A collapsed node opens when the dragged one waits over it
      if (position === 'child' && target.hasChildren() && !untrack(target.expanded)) {
        if (opening?.item !== target) {
          stopOpening();
          opening = { item: target, timer: setTimeout(() => void tree.expand(target).catch(fail), OPEN_DELAY) };
        }
      } else {
        stopOpening();
      }
    };

    // While a finger drags, the page must not scroll under it
    const noScroll = (touchmove: TouchEvent): void => touchmove.preventDefault();
    if (touch) {
      window.addEventListener('touchmove', noScroll, { passive: false });
      window.addEventListener('contextmenu', noMenu, true);
    }

    followPointer(event, root, {
      move,
      end: cancelled => {
        window.removeEventListener('touchmove', noScroll);
        window.removeEventListener('contextmenu', noMenu, true);
        stopOpening();
        const target = untrack(drop);
        ghost?.remove();
        dragged.set(null);
        drop.set(null);
        if (ghost && !cancelled && target) void tree.move(item, target.item, target.position).catch(fail);
        if (ghost) {
          // The click that follows the release is not a selection
          const swallow = (click: MouseEvent): void => click.stopPropagation();
          window.addEventListener('click', swallow, true);
          setTimeout(() => window.removeEventListener('click', swallow, true));
        }
      },
    });
    // A held finger starts dragging at once, without moving first
    if (touch) move(start);
  };

  /** How long nodes slide open and closed: --pt-anim-duration, nothing when animations are off (setMotion). */
  const duration = (): number => {
    if (!allowsMotion()) return 0;
    const value = getComputedStyle(root).getPropertyValue('--pt-anim-duration').trim();
    if (!value) return 0;
    return value.endsWith('ms') ? Number.parseFloat(value) : Number.parseFloat(value) * 1000;
  };
  const slide = (element: HTMLElement, from: number, to: number): Animation | null => {
    const ms = duration();
    if (!ms || typeof element.animate !== 'function') return null;
    return element.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: ms, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
  };

  const indents = (item: TreeItem<N>): Child => () => {
    const ancestors = item.ancestors();
    // A vertical line goes on where an ancestor has more siblings below it
    return ancestors.slice(1).map(ancestor => (
      <span class="pt-indent" data-has-line={isLast(ancestor) ? '0' : '1'} aria-hidden="true" />
    ));
  };
  const isLast = (item: TreeItem<N>): boolean => {
    const parent = item.parent();
    const siblings = (parent ? parent.children() : tree.roots()) ?? [];
    return siblings.at(-1) === item;
  };

  const Node = (item: TreeItem<N>): Child => {
    const node = item.node;
    const selected = () => !pick && tree.selected() === item.id;
    const checked = () => tree.checked().includes(item.id);
    const level = () => item.ancestors().length;

    // The children stay in the page while they slide closed, and slide open when they come
    const open = () => item.expanded() && item.hasChildren();
    const shown = state(untrack(open));
    let box: HTMLElement | null = null;
    let sliding: Animation | null = null;
    let ready = false;
    effect(() => {
      const now = open();
      untrack(() => {
        // An unfinished slide stops, the new one goes on from the height reached
        const height = box?.offsetHeight ?? 0;
        sliding?.cancel();
        sliding = null;
        if (now) return shown.set(true);
        sliding = box && shown() ? slide(box, height, 0) : null;
        if (sliding) sliding.onfinish = () => shown.set(false);
        else shown.set(false);
      });
    });

    const view = (
      <li
        class={() => classes(
          'pt-item',
          item.expanded() && item.hasChildren() && 'is-expanded',
          item.hasChildren() ? 'has-children' : 'is-leaf',
          node.disabled && 'is-disabled',
          isLast(item) && 'is-last',
          selected() && 'is-selected',
          dragged() === item && 'is-dragging',
        )}
        data-id={String(node.id)}
        role="treeitem"
        aria-level={() => level() + 1}
        aria-expanded={() => (item.hasChildren() ? String(item.expanded()) : null)}
        aria-selected={() => (pick ? null : String(selected()))}
        aria-checked={() => (pick ? String(checked()) : null)}
        aria-disabled={node.disabled ? 'true' : null}
        aria-busy={() => (item.loading() ? 'true' : null)}
        tabIndex={() => (tabStop() === item ? 0 : -1)}
        data-drop-pos={() => (drop()?.item === item ? drop()!.position : null)}
        ref={element => {
          item.element = element;
          items.set(element, item);
        }}
        onFocusin={event => {
          if (event.target === event.currentTarget) focused.set(item);
        }}
      >
        <div
          class={() => classes('pt-row', slot('row'), selected() && slot('rowSelected'))}
          onPointerdown={event => startDrag(event, item, event.currentTarget)}
          onClick={event => {
            const target = event.target as Element;
            if (target.closest('.pt-toggle')) return;
            focus(item);
            if (target.closest('a.pt-label')) return activate(item, true);
            if (target.closest('.pt-pick')) return;
            activate(item);
          }}
        >
          {indents(item)}
          {() => (level() > 0 ? <span class={classes('pt-connector', isLast(item) && 'pt-connector--last')} aria-hidden="true" /> : null)}
          <If when={() => item.hasChildren()}>
            <button
              type="button"
              class={classes('pt-toggle', slot('toggle'))}
              tabIndex={-1}
              aria-label={() => (item.expanded() ? Tree.texts.collapse : Tree.texts.expand)}
              ref={element => { element.innerHTML = TOGGLE_ICON; }}
              onClick={() => void tree.toggle(item).catch(fail)}
            />
            <Else />
            <span class="pt-toggle pt-toggle--leaf" />
          </If>
          {pick ? (
            <input
              class={classes('pt-pick', pick === 'multiple' ? 'pt-checkbox' : 'pt-radio', slot('pick'))}
              type={pick === 'multiple' ? 'checkbox' : 'radio'}
              name={props.name ? (pick === 'multiple' ? `${props.name}[]` : props.name) : null}
              value={String(node.id)}
              checked={checked}
              disabled={node.disabled ?? false}
              tabIndex={-1}
              aria-hidden="true"
              onChange={event => tree.check(item, (event.currentTarget as HTMLInputElement).checked)}
            />
          ) : null}
          {props.icon ? <span class="pt-icon">{props.icon(node, item)}</span> : null}
          {props.href ? (
            <a class={classes('pt-label', slot('label'))} href={props.href(node)} tabIndex={-1} draggable={false}>
              {props.label ? props.label(node) : node.label}
            </a>
          ) : (
            <span class={classes('pt-label', slot('label'))}>{props.label ? props.label(node) : node.label}</span>
          )}
          <If when={item.loading}>
            <span class="pt-spinner" role="status" aria-label={Tree.texts.loading} />
          </If>
        </div>
        <If when={shown}>
          <div
            class="pt-children"
            ref={element => {
              box = element;
              // Not on the first drawing, only when the user or the code opens the node
              if (ready) queueMicrotask(() => { sliding = slide(element, 0, element.scrollHeight); });
            }}
          >
            <ul class="pt-list" role="group">
              <For each={() => item.children() ?? []}>{child => Node(child)}</For>
            </ul>
          </div>
        </If>
      </li>
    );
    ready = true;
    return view;
  };

  return (
    <div
      class={classes('phlox-tree', props.lines && 'phlox-tree--lines', slot('root'), props.class)}
      data-phlox-tree
      ref={element => { root = element; }}
    >
      <ul
        {...props.attributes}
        class="pt-list"
        role="tree"
        aria-label={props['aria-label'] ?? null}
        aria-multiselectable={pick === 'multiple' ? 'true' : null}
        tabIndex={-1}
        onKeydown={onKeydown}
        // The tree itself passes the focus to its node, e.g. after a failed validation of a form
        onFocus={event => {
          if (event.target === event.currentTarget) focus(untrack(tabStop));
        }}
      >
        <For each={tree.roots}>{item => Node(item)}</For>
      </ul>
    </div>
  );
}
