/** Windows for dialogs. The service is replaceable, an adapter can show dialogs in Kendo Window instead. */
import type { Component } from './component';
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
export declare abstract class Dialogs {
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
export declare class NativeDialogs extends Dialogs {
    show(dialog: Component<any, any>, options?: DialogOptions): () => void;
}
