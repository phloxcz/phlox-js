// What every screen needs. Optional parts have their own entry points:
// phlox-js/net, phlox-js/security, phlox-js/localization and the Vite plugin phlox-js/vite.

export { Scope, batch, computed, effect, onCleanup, state, untrack } from './reactive/reactive';
export type { Accessor, State } from './reactive/reactive';

export { Fragment, h, render } from './ui/dom';
export type { Child, Reactive } from './ui/dom';
export { Else, ElseIf, For, If } from './ui/flow';
export { Component } from './ui/component';
export type { Resource, ResourceOptions } from './ui/resource';
export { BadRequestError, Presenter, RouteFrame } from './ui/presenter';
export type { LinkParams, Params, Route } from './ui/presenter';
export { Dialogs, NativeDialogs } from './ui/dialog';
export type { DialogOptions } from './ui/dialog';
export { BootstrapTheme, Theme, classes, currentTheme } from './ui/theme';
export { Button } from './ui/button';
export { BrowserPreferences, Preferences } from './ui/preferences';
export { ResizeHandle } from './ui/resize';
export type { ResizeHandleProps } from './ui/resize';
export { Dropdown } from './ui/dropdown';
export type { DropdownProps } from './ui/dropdown';
export type { ButtonProps } from './ui/button';
export { DRAGGING, dragToSort } from './ui/sortable';
export { allowsMotion, motion, setMotion } from './ui/motion';
export { MessageBox, messageTexts } from './ui/messages';
export type { LoadingHandle, MessageKind, MessageOptions, Placement, PromptOptions } from './ui/messages';
export type { Motion } from './ui/motion';
export type { SortOptions } from './ui/sortable';
export type { ThemeClasses, ThemeSlot } from './ui/theme';

export { Application, FlashMessages } from './application/application';
export type { Flash, FlashOptions, ToastPosition } from './application/application';
export { Router } from './application/router';

export { Container } from './di/container';
export type { Class, Type } from './di/container';
