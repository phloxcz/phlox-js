/**
 * TSX renderer. `h()` returns only a template, real DOM is created once, when the template is inserted.
 * Later changes go directly to the nodes that depend on them.
 */

import { Scope, effect, getScope, onCleanup, untrack } from '../reactive/reactive';
import type { Child } from './jsx';

export type { Child, Reactive } from './jsx';

type Component = ((props: any) => Child) | (abstract new (...args: any[]) => unknown);

/** A class used as a tag has a static method under this key, it creates the view for the given props. */
export const VIEW = Symbol('view');

/** Key under which a scope provides where errors of event handlers go; the application gives app.onError. */
export const ERRORS = Symbol('errors');

/** Set as DOM properties, their attributes hold only the initial value. */
const PROPERTIES = new Set(['value', 'checked', 'selected', 'muted', 'indeterminate']);

/** `false` is a real value here, for other attributes it means the attribute is absent. */
const STRINGIFIED = /^(aria-|data-|draggable$|contenteditable$|spellcheck$)/;

const TEMPLATE = Symbol('template');

const SVG = 'http://www.w3.org/2000/svg';

/** SVG while the children of an <svg> are created, so that <path> inside it is an SVG element. */
let inSvg = false;

/**
 * Runs the function with the namespace of children of the parent: SVG inside <svg>, except in <foreignObject>.
 * A fragment is not in the page yet, what is created into it keeps the namespace of the place that creates it.
 */
export function withNamespaceOf<T>(parent: Node, fn: () => T): T {
  if (parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE) return fn();
  const previous = inSvg;
  inSvg = (parent as Element).namespaceURI === SVG && parent.nodeName !== 'foreignObject';
  try {
    return fn();
  } finally {
    inSvg = previous;
  }
}

interface TemplateInfo {
  tag: string | Component;
  props: Record<string, unknown> | null;
}

/**
 * Creates a template. Nothing is built and no component runs until the template is inserted,
 * so a branch that is never shown costs nothing. Every insertion creates a new instance.
 */
export function h(tag: string | Component, props: Record<string, unknown> | null, ...children: Child[]): Child {
  const create = (): Child => {
    if (typeof tag === 'function') {
      const all = { ...props };
      if (children.length > 0) all.children = children.length === 1 ? children[0] : children;
      const view = (tag as { [VIEW]?: (props: object) => Child })[VIEW];
      return view ? view.call(tag, all) : (tag as (props: object) => Child)(all);
    }

    const element = tag === 'svg' || inSvg ? document.createElementNS(SVG, tag) as unknown as HTMLElement : document.createElement(tag);
    withNamespaceOf(element, () => insert(element, children, null));
    // After children, a <select> can take its value only when its options exist
    for (const [name, value] of Object.entries(props ?? {})) {
      if (name !== 'ref') setProp(element, name, value);
    }
    (props?.ref as ((element: HTMLElement) => void) | undefined)?.(element);
    return element;
  };
  const info: TemplateInfo = { tag, props };
  return Object.assign(create, { [TEMPLATE]: info });
}

/** Tells what a template was made from, or null when the value is not a template. */
export function templateOf(value: unknown): TemplateInfo | null {
  return typeof value === 'function' && TEMPLATE in value ? (value as unknown as Record<symbol, TemplateInfo>)[TEMPLATE]! : null;
}

export function Fragment(props: { children?: Child }): Child {
  const fragment = document.createDocumentFragment();
  insert(fragment, props.children, null);
  return fragment;
}

function setProp(element: HTMLElement, name: string, value: unknown): void {
  if (/^on[A-Z]/.test(name)) {
    const type = name.slice(2).toLowerCase();
    const listener = withErrors(value as (event: Event) => unknown);
    element.addEventListener(type, listener);
    onCleanup(() => element.removeEventListener(type, listener));
  } else if (typeof value === 'function') {
    effect(() => applyProp(element, name, value()));
  } else {
    applyProp(element, name, value);
  }
}

/**
 * An error of a handler, thrown or of the promise it returns (`onClick={() => this.handleSave()}`),
 * goes to the application instead of getting lost. Outside an application the handler stays as it is.
 */
function withErrors(handler: (event: Event) => unknown): EventListener {
  const report = getScope()?.find<(error: unknown) => void>(ERRORS);
  if (!report) return handler as EventListener;
  return event => {
    try {
      const result = handler(event);
      if (typeof (result as PromiseLike<unknown> | null)?.then === 'function') (result as Promise<unknown>).then(undefined, report);
    } catch (error) {
      report(error);
    }
  };
}

function applyProp(element: HTMLElement, name: string, value: unknown): void {
  if (PROPERTIES.has(name)) {
    (element as unknown as Record<string, unknown>)[name] = value ?? '';
  } else if (name === 'style' && typeof value === 'object' && value !== null) {
    element.removeAttribute('style');
    Object.assign(element.style, value);
  } else if (value === null || value === undefined || (value === false && !STRINGIFIED.test(name))) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, value === true && !STRINGIFIED.test(name) ? '' : String(value));
  }
}

/**
 * Inserts anything a view can contain. A template is created now,
 * any other function becomes a region that keeps itself up to date.
 */
export function insert(parent: Node, value: Child, before: Node | null): void {
  if (value === null || value === undefined || typeof value === 'boolean') return;
  if (Array.isArray(value)) {
    for (const item of value) insert(parent, item, before);
  } else if (templateOf(value)) {
    // Untracked, state read in a component body must not rerun the region around it
    insert(parent, untrack(value as () => Child), before);
  } else if (typeof value === 'function') {
    region(parent, value, before);
  } else if (value instanceof Node) {
    parent.insertBefore(value, before);
  } else {
    parent.insertBefore(document.createTextNode(String(value)), before);
  }
}

/** Content between two markers. Text is updated in place, anything else is replaced. */
function region(parent: Node, read: () => Child, before: Node | null): void {
  const start = parent.insertBefore(document.createComment(''), before);
  const end = parent.insertBefore(document.createComment(''), before);
  let text: Text | null = null;

  effect(() => {
    const value = read();
    if (text && (typeof value === 'string' || typeof value === 'number')) {
      text.data = String(value);
      return;
    }
    removeBetween(start, end);
    text = null;
    if (typeof value === 'string' || typeof value === 'number') {
      text = document.createTextNode(String(value));
      end.parentNode!.insertBefore(text, end);
    } else {
      // A rerun can come long after the parent was created
      withNamespaceOf(end.parentNode!, () => insert(end.parentNode!, value, end));
    }
  });
}

function removeBetween(start: Node, end: Node): void {
  while (start.nextSibling !== end) end.parentNode!.removeChild(start.nextSibling!);
}

/**
 * Renders a view into the container and returns a function that removes it.
 * The view is built aside, so a failure leaves nothing in the page.
 */
export function render(view: () => Child, container: Node): () => void {
  const scope = new Scope(null);
  const fragment = document.createDocumentFragment();
  const start = fragment.appendChild(document.createComment(''));
  const end = fragment.appendChild(document.createComment(''));
  try {
    scope.run(() => insert(fragment, untrack(view), end));
  } catch (error) {
    scope.dispose();
    throw error;
  }
  container.appendChild(fragment);
  return () => {
    scope.dispose();
    removeBetween(start, end);
    start.parentNode?.removeChild(start);
    end.parentNode?.removeChild(end);
  };
}
