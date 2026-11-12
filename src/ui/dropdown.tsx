/**
 * A button with a panel of any content: a menu of the user, notifications, a filter.
 * The panel is placed like the popover of confirm(), so a scrolled container does not clip it.
 */

import { Scope, getScope, onCleanup, state, untrack } from '../reactive/reactive';
import { insert } from './dom';
import type { Child, Reactive } from './dom';
import { classes, currentTheme } from './theme';
import { placePopover } from './messages';
import type { Placement } from './messages';

export interface DropdownProps {
  /** Content of the button. */
  label: Child;
  /** The name of the button for screen readers, when the label is only an icon. */
  title?: string;
  /** Classes of the button, added to the theme slot `dropdown.button`. */
  class?: Reactive<string | undefined>;
  /** Classes of the panel, added to the theme slot `dropdown.panel`. */
  panelClass?: string;
  /** Where the panel is, it turns over when there is no room. */
  placement?: Placement;
  /** Called when the panel opens, e.g. to load what it shows. */
  onOpen?: () => void;
  children?: Child;
}

/**
 * The panel opens by a click on the button. A click on a link or a button inside it, a click outside it
 * and Escape close it; then the focus goes back to the button. The content is created anew on every opening.
 */
export function Dropdown(props: DropdownProps): Child {
  const owner = getScope();
  const theme = currentTheme();
  const opened = state(false);
  let button: HTMLButtonElement;
  let close = (): void => {};

  const open = (): void => {
    const scope = new Scope(owner);
    const panel = document.createElement('div');
    panel.className = classes(theme.class('dropdown.panel'), props.panelClass);
    scope.run(() => insert(panel, props.children, null));
    // In a modal dialog the panel must be inside it, the rest of the page is under its backdrop
    (button.closest('dialog') ?? document.body).append(panel);

    const place = (): void => {
      Object.assign(panel.style, { position: 'fixed', margin: '0' });
      const { top, left, y } = placePopover(button, panel, props.placement ?? 'bottom-left');
      Object.assign(panel.style, { top: `${top}px`, left: `${left}px` });
      panel.dataset.placement = y;
    };
    const outside = (event: PointerEvent): void => {
      if (!panel.contains(event.target as Node) && !button.contains(event.target as Node)) close();
    };
    const keydown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      // Only the panel closes, not a dialog under it
      event.preventDefault();
      event.stopPropagation();
      close();
      button.focus();
    };
    const click = (event: MouseEvent): void => {
      if ((event.target as Element).closest('a, button')) queueMicrotask(close);
    };

    close = () => {
      close = () => {};
      opened.set(false);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('pointerdown', outside, true);
      scope.dispose();
      panel.remove();
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('pointerdown', outside, true);
    panel.addEventListener('keydown', keydown);
    panel.addEventListener('click', click);
    opened.set(true);
    props.onOpen?.();
    panel.querySelector<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')?.focus();
  };

  onCleanup(() => close());

  return (
    <button
      type="button"
      class={() => classes(theme.class('dropdown.button'), typeof props.class === 'function' ? props.class() : props.class)}
      title={props.title ?? null}
      aria-label={props.title ?? null}
      aria-haspopup="true"
      aria-expanded={() => String(opened())}
      ref={element => { button = element; }}
      onClick={() => (untrack(opened) ? close() : open())}
    >
      {props.label}
    </button>
  );
}
