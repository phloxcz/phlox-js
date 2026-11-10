/**
 * Automatic JSX runtime. The compiler imports this module by itself (see `jsxImportSource` in tsconfig.json),
 * so files with TSX do not import `h`.
 */

import { Fragment, h } from './ui/dom';
import type { Child } from './ui/dom';
import type { ElementMap } from './ui/jsx';
import type { Component } from './ui/component';

export { Fragment };

/** The compiler passes children inside props and the `key` attribute separately, `h` wants both the usual way. */
export function jsx(tag: Parameters<typeof h>[0], props: Record<string, unknown>, key?: unknown): Child {
  const { children, ...rest } = props;
  if (key !== undefined) rest.key = key;
  return children === undefined ? h(tag, rest) : h(tag, rest, children as Child);
}

export { jsx as jsxs, jsx as jsxDEV };

export namespace JSX {
  export type Element = Child;
  /** A class used as a tag must be a Component, its attributes are the type of `props`. */
  export type ElementClass = Component<any, any>;
  export interface ElementAttributesProperty { props: unknown }
  export interface IntrinsicClassAttributes<T> { ref?: (component: T) => void }
  export interface ElementChildrenAttribute { children: unknown }
  export interface IntrinsicElements extends ElementMap {}
}
