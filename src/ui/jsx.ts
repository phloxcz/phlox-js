/** Types of TSX elements, derived from the DOM types of TypeScript so attributes are checked by the compiler. */

export type Child = Node | string | number | boolean | null | undefined | Child[] | (() => Child);

/** A plain value, or a function (a state too) that keeps the attribute up to date. */
export type Reactive<T> = T | (() => T);

type Equals<A, B, Yes, No> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? Yes : No;

type WritableKeys<E> = {
  [K in keyof E]-?: Equals<{ [P in K]: E[K] }, { -readonly [P in K]: E[K] }, K, never>;
}[keyof E];

/** Replaced by `class` and `for`, unsafe (HTML from a string), or written as `aria-*` and children. */
type HiddenKeys =
  | 'className' | 'htmlFor' | 'style'
  | 'innerHTML' | 'outerHTML' | 'innerText' | 'outerText' | 'textContent' | 'nodeValue'
  | `aria${string}`;

type AttributeKeys<E> = {
  [K in WritableKeys<E> & string]: K extends HiddenKeys ? never : NonNullable<E[K]> extends string | number | boolean ? K : never;
}[WritableKeys<E> & string];

type EventProps<E> = {
  [K in keyof GlobalEventHandlersEventMap as `on${Capitalize<K>}`]?: (event: GlobalEventHandlersEventMap[K] & { currentTarget: E }) => void;
};

export type ElementProps<E> =
  & { [K in AttributeKeys<E>]?: Reactive<E[K] | null | undefined> }
  & EventProps<E>
  & {
    class?: Reactive<string | null | undefined>;
    for?: Reactive<string | null | undefined>;
    style?: Reactive<string | Partial<CSSStyleDeclaration> | null | undefined>;
    ref?: (element: E) => void;
    children?: Child;
  };

/**
 * SVG elements have their attributes only as read-only objects (SVGAnimatedLength), so the common
 * attributes are listed here. Names with a hyphen (`stroke-width`, `aria-hidden`) are not checked by TypeScript.
 */
type SvgAttribute =
  | 'viewBox' | 'xmlns' | 'fill' | 'stroke' | 'opacity' | 'transform' | 'd' | 'points' | 'pathLength'
  | 'x' | 'y' | 'x1' | 'y1' | 'x2' | 'y2' | 'cx' | 'cy' | 'r' | 'rx' | 'ry' | 'width' | 'height'
  | 'preserveAspectRatio' | 'href' | 'id' | 'role' | 'tabIndex' | 'focusable' | 'offset';

export type SvgProps<E> =
  & { [K in SvgAttribute]?: Reactive<string | number | null | undefined> }
  & EventProps<E>
  & {
    class?: Reactive<string | null | undefined>;
    style?: Reactive<string | Partial<CSSStyleDeclaration> | null | undefined>;
    ref?: (element: E) => void;
    children?: Child;
  };

/** Tags with the same name in HTML and SVG (a, title, style, script) are typed as HTML. */
type SvgOnly = Exclude<keyof SVGElementTagNameMap, keyof HTMLElementTagNameMap>;

export type ElementMap =
  & { [K in keyof HTMLElementTagNameMap]: ElementProps<HTMLElementTagNameMap[K]> }
  & { [K in SvgOnly]: SvgProps<SVGElementTagNameMap[K]> };
