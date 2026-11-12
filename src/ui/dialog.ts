/** Windows for dialogs. The service is replaceable, an adapter can show dialogs in Kendo Window instead. */

import { h, insert } from './dom';
import { renderComponent } from './component';
import type { Component } from './component';
import { currentTheme } from './theme';
import { allowsMotion } from './motion';

/** How a dialog is shown. Given to openDialog() or as the third item of `dialog` of a route. */
export interface DialogOptions {
  /**
   * `center` (default) is a window in the middle, `end` and `start` a panel sliding in from the right
   * or the left over the whole height, like offcanvas in Bootstrap; good for big forms.
   */
  placement?: 'center' | 'end' | 'start';
  /** Classes of the window, e.g. for its width. */
  class?: string;
}

export abstract class Dialogs {
  /**
   * Shows the component in a window: its title(), render() and actions().
   * The user's request to close the window (Escape, ×, a click beside it) must go through component.cancel().
   * Returns a function that removes the window.
   */
  abstract show(dialog: Component<any, any>, options?: DialogOptions): () => void;
}

/**
 * Uses the native <dialog> element, without any dependency. Classes come from the theme, the animations
 * of opening and closing (and of the backdrop) are in styles/base.css and follow setMotion().
 */
export class NativeDialogs extends Dialogs {
  show(dialog: Component<any, any>, options: DialogOptions = {}): () => void {
    const element = document.createElement('dialog');
    // Escape must close the dialog through the component: it may ask about unsaved changes, the opener gets its result
    element.addEventListener('cancel', event => {
      event.preventDefault();
      void dialog.cancel();
    });
    // A click on the backdrop (outside the window) is a request to close, as in Bootstrap. Both the press and
    // the release must be there, so selecting text that ends outside the window does not close it.
    let pressedOutside = false;
    const outside = (event: MouseEvent) => event.target === element && !element.firstElementChild?.contains(event.target as Node);
    element.addEventListener('pointerdown', event => { pressedOutside = outside(event); });
    element.addEventListener('click', event => {
      if (pressedOutside && outside(event)) void dialog.cancel();
      pressedOutside = false;
    });

    dialog.scope.run(() => {
      const theme = currentTheme();
      element.className = [theme.class('dialog'), options.class].filter(Boolean).join(' ');
      if (options.placement && options.placement !== 'center') element.dataset.placement = options.placement;
      insert(element, h('div', { class: theme.class('dialogContent') },
        h('header', { class: theme.class('dialogHeader') },
          h('h2', { class: theme.class('dialogTitle') }, () => dialog.title()),
          h('button', { type: 'button', class: theme.class('dialogClose'), 'aria-label': 'Close', onClick: () => void dialog.cancel() },
            theme.closeText),
        ),
        h('div', { class: theme.class('dialogBody') }, renderComponent(dialog)),
        h('footer', { class: theme.class('dialogFooter') }, () => dialog.actions()),
      ), null);
    });

    document.body.append(element);
    // Missing in jsdom
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
    focusFirst(element);
    return () => closeAnimated(element);
  }
}

/**
 * The browser would focus the first button, which is × in the header. As in Bootstrap the focus goes
 * to the first field of the body instead, or to the window itself. An element with autofocus wins.
 */
function focusFirst(element: HTMLDialogElement): void {
  if (element.querySelector('[autofocus]')) return;
  const field = element.querySelector<HTMLElement>(
    ':scope > div > div :is(input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [role=combobox])',
  );
  if (field) {
    field.focus();
    return;
  }
  element.tabIndex = -1;
  element.focus();
}

/** Plays the closing animation of base.css, then removes the window. Without animations at once. */
function closeAnimated(element: HTMLDialogElement): void {
  if (!allowsMotion() || typeof element.getAnimations !== 'function') {
    element.remove();
    return;
  }
  element.classList.add('phlox-closing');
  const running = element.getAnimations();
  // A fallback, in case the animation never ends (the element is hidden, a theme without it)
  const timer = setTimeout(() => element.remove(), 400);
  void Promise.allSettled(running.map(animation => animation.finished)).then(() => {
    clearTimeout(timer);
    element.remove();
  });
}
