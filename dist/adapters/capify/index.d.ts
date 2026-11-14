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
    notify(message: string, options?: Record<string, unknown>): {
        close(): void;
    };
}
/** Options of Capify.notify() used for every message, e.g. `position` or `theme`. */
export type CapifyNotifyOptions = Record<string, unknown>;
export declare class CapifyFlashMessages extends FlashMessages {
    private capify;
    private options;
    private handles;
    constructor(capify: CapifyNotify, options?: CapifyNotifyOptions);
    /** Shows the message as a toast. It is not kept in `messages`, capify takes care of it and of its timer. */
    add(text: string, type?: string, options?: FlashOptions): Flash;
    remove(flash: Flash): void;
    clear(): void;
}
