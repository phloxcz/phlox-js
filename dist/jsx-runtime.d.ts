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
export declare function jsx(tag: Parameters<typeof h>[0], props: Record<string, unknown>, key?: unknown): Child;
export { jsx as jsxs, jsx as jsxDEV };
export declare namespace JSX {
    type Element = Child;
    /** A class used as a tag must be a Component, its attributes are the type of `props`. */
    type ElementClass = Component<any, any>;
    interface ElementAttributesProperty {
        props: unknown;
    }
    interface IntrinsicClassAttributes<T> {
        ref?: (component: T) => void;
    }
    interface ElementChildrenAttribute {
        children: unknown;
    }
    interface IntrinsicElements extends ElementMap {
    }
}
