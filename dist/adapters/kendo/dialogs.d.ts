/**
 * KendoDialogs: dialogs of the framework in Kendo Window. Registered instead of the native <dialog>:
 *
 *   services.add(new Kendo(kendo), KendoDialogs);
 *
 * Components do not change: title() is the title of the window, render() its content, actions() its buttons.
 */
import { Dialogs } from '../../ui/dialog';
import type { DialogOptions } from '../../ui/dialog';
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
export declare class KendoDialogs extends Dialogs {
    private kendo;
    static $inject: () => (typeof Kendo)[];
    constructor(kendo: Kendo);
    show(dialog: Component<any, any>, options?: DialogOptions): () => void;
}
