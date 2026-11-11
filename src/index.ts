// What every screen needs. Optional parts have their own entry points:
// phlox-js/net, phlox-js/security, phlox-js/localization and the Vite plugin phlox-js/vite.

export { Scope, batch, computed, effect, onCleanup, state, untrack } from './reactive/reactive';
export type { Accessor, State } from './reactive/reactive';

export { Fragment, h, render } from './ui/dom';
export type { Child, Reactive } from './ui/dom';
export { Else, ElseIf, For, If } from './ui/flow';
export { Component } from './ui/component';
export { BadRequestError, Presenter, RouteFrame } from './ui/presenter';
export type { LinkParams, Params, Route } from './ui/presenter';
export { Dialogs, NativeDialogs } from './ui/dialog';

export { Application, FlashMessages } from './application/application';
export type { Flash, FlashOptions } from './application/application';
export { Router } from './application/router';

export { Container } from './di/container';
export type { Class, Type } from './di/container';
