/**
 * TSX renderer. `h()` returns only a template, real DOM is created once, when the template is inserted.
 * Later changes go directly to the nodes that depend on them.
 */
import type { Child } from './jsx';
export type { Child, Reactive } from './jsx';
type Component = ((props: any) => Child) | (abstract new (...args: any[]) => unknown);
/** A class used as a tag has a static method under this key, it creates the view for the given props. */
export declare const VIEW: unique symbol;
/** Key under which a scope provides where errors of event handlers go; the application gives app.onError. */
export declare const ERRORS: unique symbol;
/**
 * Runs the function with the namespace of children of the parent: SVG inside <svg>, except in <foreignObject>.
 * A fragment is not in the page yet, what is created into it keeps the namespace of the place that creates it.
 */
export declare function withNamespaceOf<T>(parent: Node, fn: () => T): T;
interface TemplateInfo {
    tag: string | Component;
    props: Record<string, unknown> | null;
    /** What was written between the tags, as a component gets it in props.children */
    children: Child | undefined;
}
/**
 * Creates a template. Nothing is built and no component runs until the template is inserted,
 * so a branch that is never shown costs nothing. Every insertion creates a new instance.
 */
export declare function h(tag: string | Component, props: Record<string, unknown> | null, ...children: Child[]): Child;
/** Tells what a template was made from, or null when the value is not a template. */
export declare function templateOf(value: unknown): TemplateInfo | null;
export declare function Fragment(props: {
    children?: Child;
}): Child;
/**
 * Inserts anything a view can contain. A template is created now,
 * any other function becomes a region that keeps itself up to date.
 */
export declare function insert(parent: Node, value: Child, before: Node | null): void;
/**
 * Renders a view into the container and returns a function that removes it.
 * The view is built aside, so a failure leaves nothing in the page.
 */
export declare function render(view: () => Child, container: Node): () => void;
