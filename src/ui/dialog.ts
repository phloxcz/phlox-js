/** Windows for dialogs. The service is replaceable, an adapter can show dialogs in Kendo Window instead. */

import { h, insert } from './dom';
import { renderComponent } from './component';
import type { Component } from './component';
import { currentTheme } from './theme';

export abstract class Dialogs {
  /**
   * Shows the component in a window: its title(), render() and actions().
   * A request to close the window must go through component.close().
   * Returns a function that removes the window.
   */
  abstract show(dialog: Component<any, any>): () => void;
}

/** Uses the native <dialog> element, without any dependency. Classes come from the theme. */
export class NativeDialogs extends Dialogs {
  show(dialog: Component<any, any>): () => void {
    const element = document.createElement('dialog');
    // Escape must close the dialog through the component, so the opener gets its result
    element.addEventListener('cancel', event => {
      event.preventDefault();
      dialog.close();
    });

    dialog.scope.run(() => {
      const theme = currentTheme();
      element.className = theme.class('dialog');
      insert(element, h('div', { class: theme.class('dialogContent') },
        h('header', { class: theme.class('dialogHeader') },
          h('h2', { class: theme.class('dialogTitle') }, () => dialog.title()),
          h('button', { type: 'button', class: theme.class('dialogClose'), 'aria-label': 'Close', onClick: () => dialog.close() },
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
    return () => element.remove();
  }
}
