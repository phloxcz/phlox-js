/**
 * KendoDialogs: dialogs of the framework in Kendo Window. Registered instead of the native <dialog>:
 *
 *   services.add(new Kendo(kendo), KendoDialogs);
 *
 * Components do not change: title() is the title of the window, render() its content, actions() its buttons.
 */

import { effect } from '../../reactive/reactive';
import { h, insert } from '../../ui/dom';
import { Dialogs } from '../../ui/dialog';
import type { DialogOptions } from '../../ui/dialog';
import { renderComponent } from '../../ui/component';
import type { Component } from '../../ui/component';
import { Kendo } from './kendo';
import type { KendoWidgetInstance } from './kendo';

/** The part of Kendo Window the adapter uses. */
export interface KendoWindowInstance extends KendoWidgetInstance {
  title(text: string): unknown;
  center(): KendoWindowInstance;
  open(): KendoWindowInstance;
  wrapper: ArrayLike<HTMLElement>;
}

export class KendoDialogs extends Dialogs {
  static $inject = () => [Kendo];

  constructor(private kendo: Kendo) {
    super();
  }

  show(dialog: Component<any, any>, options: DialogOptions = {}): () => void {
    const element = document.createElement('div');
    element.className = ['phlox-kendo-window', options.class].filter(Boolean).join(' ');
    dialog.scope.run(() => insert(element, [
      h('div', { class: 'phlox-kendo-window-body' }, renderComponent(dialog)),
      h('div', { class: 'k-actions k-actions-end phlox-kendo-window-actions' }, () => dialog.actions()),
    ], null));
    document.body.append(element);

    const side = options.placement === 'end' || options.placement === 'start';
    const window = this.kendo.create<KendoWindowInstance>('Window', element, {
      modal: true,
      visible: false,
      title: '',
      actions: ['Close'],
      resizable: !side,
      draggable: !side,
      // The × and Escape of Kendo are a request of the user: the component may ask about unsaved changes
      close: (event: { userTriggered?: boolean; preventDefault(): void }) => {
        if (!event.userTriggered) return;
        event.preventDefault();
        void dialog.cancel();
      },
    });
    // A panel at the side keeps to its edge over the whole height, see adapters/kendo/kendo.css
    if (side) window.wrapper[0]?.classList.add('phlox-kendo-panel', `phlox-kendo-panel-${options.placement}`);
    dialog.scope.run(() => effect(() => {
      const title = dialog.title();
      window.title(typeof title === 'string' || typeof title === 'number' ? String(title) : '');
    }));
    window.center().open();
    return () => window.destroy();
  }
}
