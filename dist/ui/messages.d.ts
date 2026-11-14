/**
 * Messages for the user, taken over from @phloxcz/capify: alert, confirm and prompt as a dialog or as a popover
 * at an element, a dialog while something loads, and toasts for flash messages. Classes come from the theme,
 * so they follow Bootstrap, the dark mode and setMotion() like the rest of the framework.
 */
import { Scope } from '../reactive/reactive';
import type { Child } from './dom';
import { Component } from './component';
import type { FlashMessages } from '../application/application';
export type Placement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type MessageKind = 'alert' | 'confirm' | 'prompt';
export interface MessageOptions {
    title?: Child;
    okText?: string;
    cancelText?: string;
    /** The OK button warns: deleting, overwriting... */
    danger?: boolean;
    /** Shows a small popover at this element instead of a dialog, e.g. at the button that asked. */
    anchor?: HTMLElement | null;
    /** Where the popover is, it turns over when there is no room. */
    placement?: Placement;
}
export interface PromptOptions extends MessageOptions {
    value?: string;
    placeholder?: string;
}
/** A dialog shown while something runs, see loading(). */
export interface LoadingHandle {
    update(message: Child): void;
    close(): void;
}
export declare const messageTexts: {
    ok: string;
    cancel: string;
    close: string;
    loading: string;
    /** The question before leaving unsaved changes and its button. */
    unsaved: string;
    leave: string;
};
interface BoxProps {
    kind: MessageKind;
    message: Child;
    options: PromptOptions;
}
/** The content of alert, confirm and prompt in a dialog of the framework. */
export declare class MessageBox extends Component<BoxProps, boolean | string> {
    readonly value: import("..").State<string>;
    title(): string | number | boolean | Child[] | Node | (() => Child);
    actions(): Child[];
    render(): Child;
}
/** Shows alert, confirm or prompt as a dialog opened by the component, or as a popover with `anchor`. */
export declare function showMessage(opener: Component<any, any>, kind: MessageKind, message: Child, options?: PromptOptions): Promise<boolean | string | null>;
/** Where a popover goes: under or above the element, aligned to its left or right, turned over when it does not fit. */
export declare function placePopover(anchor: HTMLElement, popover: HTMLElement, placement: Placement): {
    top: number;
    left: number;
    y: "bottom" | "top";
    arrow: number;
};
/**
 * A dialog without buttons while something runs. It cannot be closed by the user, only by close().
 * The message can be changed: handle.update('Saving 2 of 5…').
 */
export declare function showLoading(owner: Scope, message?: Child): LoadingHandle;
/**
 * Flash messages as toasts, like the notifications of capify: they stack in a corner, disappear by themselves
 * with a bar of the remaining time, wait while the pointer or the focus is on them, and can be closed.
 * The Application shows them; a layout that shows flash messages itself sets flashes.toasts = false.
 */
export declare function Toasts(props: {
    flashes: FlashMessages;
}): Child;
export {};
