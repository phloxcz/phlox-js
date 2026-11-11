/**
 * Adapter for @phloxcz/capify: flash messages shown as its toasts.
 * It does not import capify, the application passes it in, so phlox-js itself has no dependency on it:
 *
 *   import * as Capify from '@phloxcz/capify';
 *   services.add(new CapifyFlashMessages(Capify, { position: 'top-right' }));
 */

import { FlashMessages } from '../../application/application';
import type { Flash, FlashOptions } from '../../application/application';

/** The part of capify the adapter needs. */
export interface CapifyNotify {
  notify(message: string, options?: Record<string, unknown>): { close(): void };
}

/** Options of Capify.notify() used for every message, e.g. `position` or `theme`. */
export type CapifyNotifyOptions = Record<string, unknown>;

const TYPES = new Set(['info', 'success', 'warning', 'error']);

export class CapifyFlashMessages extends FlashMessages {
  private handles = new Map<Flash, { close(): void }>();

  constructor(private capify: CapifyNotify, private options: CapifyNotifyOptions = {}) {
    super();
    // Capify shows the messages, not the toasts of the framework
    this.toasts = false;
  }

  /** Shows the message as a toast. It is not kept in `messages`, capify takes care of it and of its timer. */
  override add(text: string, type = 'info', options: FlashOptions = {}): Flash {
    const duration = options.duration ?? (type === 'error' ? this.errorDuration : this.duration);
    const flash: Flash = { text, type, duration, ...(options.title ? { title: options.title } : {}) };
    const handle = this.capify.notify(text, {
      ...this.options,
      type: TYPES.has(type) ? type : 'info',
      duration,
      ...(options.title ? { title: options.title } : {}),
    });
    this.handles.set(flash, handle);
    return flash;
  }

  override remove(flash: Flash): void {
    this.handles.get(flash)?.close();
    this.handles.delete(flash);
  }

  override clear(): void {
    for (const handle of this.handles.values()) handle.close();
    this.handles.clear();
  }
}
