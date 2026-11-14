/**
 * HTML written by users (comments from an editor, content of a CMS) in a template. Like |noescape in Latte,
 * but cleaned first: only allowed tags and attributes stay, links and images only with safe addresses.
 * Text is still written as {text}, which needs no cleaning; <Html> is only for HTML.
 */

import { effect } from '../reactive/reactive';
import type { Child, Reactive } from './dom';
import { sanitizeHtml } from './sanitize';
import type { SanitizeOptions } from './sanitize';

export interface HtmlProps {
  /** The HTML, cleaned by sanitizeHtml() before it is shown. */
  html: Reactive<string | null | undefined>;
  /** The element around it, a <div> by default. */
  tag?: 'div' | 'span' | 'section' | 'article';
  class?: Reactive<string | null | undefined>;
  options?: SanitizeOptions;
}

/** <Html html={() => comment().text} class="comment-text" />: cleaned HTML, shown again when it changes. */
export function Html(props: HtmlProps): Child {
  const Tag = props.tag ?? 'div';
  return (
    <Tag class={props.class} ref={(element: HTMLElement) => effect(() => {
      const html = typeof props.html === 'function' ? props.html() : props.html;
      element.innerHTML = sanitizeHtml(html ?? '', props.options);
    })} />
  );
}
