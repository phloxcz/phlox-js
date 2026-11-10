/** Windows for dialogs. The service is replaceable, an adapter can show dialogs in Kendo Window instead. */

import { h, insert } from './dom';
import { renderComponent } from './component';
import type { Component } from './component';

export abstract class Dialogs {
  /**
   * Shows the component in a window: its title(), render() and actions().
   * A request to close the window must go through component.close().
   * Returns a function that removes the window.
   */
  abstract show(dialog: Component<any, any>): () => void;
}

/** Uses the native <dialog> element, without any dependency. Style it by the class `phlox-dialog`. */
export class NativeDialogs extends Dialogs {
  show(dialog: Component<any, any>): () => void {
    const element = document.createElement('dialog');
    element.className = 'phlox-dialog';
    // Escape must close the dialog through the component, so the opener gets its result
    element.addEventListener('cancel', event => {
      event.preventDefault();
      dialog.close();
    });

    dialog.scope.run(() => insert(element, [
      h('header', null,
        h('h2', null, () => dialog.title()),
        h('button', { type: 'button', 'aria-label': 'Close', onClick: () => dialog.close() }, '×'),
      ),
      h('div', { class: 'phlox-dialog-body' }, renderComponent(dialog)),
      h('footer', null, () => dialog.actions()),
    ], null));

    document.body.append(element);
    // Missing in jsdom
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
    return () => element.remove();
  }
}
