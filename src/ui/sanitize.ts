/**
 * Cleaning of HTML written by users (comments from an editor, content of a CMS): only allowed tags and
 * attributes stay, links and images only with safe addresses. In the browser for <Html>, on a server with
 * the document of jsdom, so both clean the same way.
 */

export interface SanitizeOptions {
  /** Tags allowed on top of the default ones, with their attributes: { iframe: ['src', 'width', 'height'] }. */
  tags?: Record<string, string[]>;
  /** Keep the class attribute. Off by default: classes of the page could restyle it (cover the page…). */
  classes?: boolean;
  /** The document to parse in, on a server e.g. new JSDOM('').window.document. */
  document?: Document;
}

const GLOBAL = ['title', 'style'];
/** The allowed tags and their own attributes. */
const TAGS: Record<string, string[]> = {
  p: [], br: [], strong: [], b: [], em: [], i: [], u: [], s: [], sub: [], sup: [], small: [], mark: [], span: [], div: [],
  h1: [], h2: [], h3: [], h4: [], h5: [], h6: [], blockquote: [], pre: [], code: [], hr: [],
  ul: [], ol: ['start'], li: [], figure: [], figcaption: [],
  table: [], caption: [], thead: [], tbody: [], tfoot: [], tr: [], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'],
  a: ['href', 'target'], img: ['src', 'alt', 'width', 'height'],
};
/** Removed with their content; other unknown tags are replaced by their content. */
const DROPPED = new Set([
  'script', 'style', 'template', 'noscript', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'button',
  'select', 'textarea', 'link', 'meta', 'base', 'title', 'head',
]);
/** CSS properties that can only change the look of the text, not cover or move the page. */
const STYLES = ['color', 'background-color', 'text-align', 'font-weight', 'font-style', 'text-decoration', 'width', 'height'];
const LINK = /^(https?:|mailto:|tel:|#|\/|\.|[^:]*$)/i;
const IMAGE = /^(https?:|\/|\.|data:image\/(png|jpeg|gif|webp);|[^:]*$)/i;

/** The HTML with only allowed tags, attributes and addresses. Works on a server too, with options.document. */
export function sanitizeHtml(html: string, options: SanitizeOptions = {}): string {
  const doc = (options.document ?? document).implementation.createHTMLDocument('');
  // A template is inert: nothing runs and no image loads while it is cleaned
  const template = doc.createElement('template');
  template.innerHTML = html;
  const tags = { ...TAGS, ...options.tags };
  clean(template.content, tags, options.classes ?? false);
  return template.innerHTML;
}

function clean(parent: ParentNode, tags: Record<string, string[]>, classes: boolean): void {
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === 3) continue;
    if (node.nodeType !== 1) {
      node.remove();   // comments, processing instructions
      continue;
    }
    const element = node as Element;
    const tag = element.localName;
    if (DROPPED.has(tag)) {
      element.remove();
      continue;
    }
    clean(element, tags, classes);
    const allowed = tags[tag];
    if (!allowed) {
      element.replaceWith(...element.childNodes);
      continue;
    }
    for (const { name, value } of [...element.attributes]) {
      const keep = GLOBAL.includes(name) || allowed.includes(name) || (classes && name === 'class');
      if (!keep || !safeValue(tag, name, value)) element.removeAttribute(name);
    }
    if (element.hasAttribute('style')) cleanStyle(element as HTMLElement);
    if (tag === 'a' && element.hasAttribute('target')) {
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
    }
  }
}

function safeValue(tag: string, name: string, value: string): boolean {
  const address = value.trim().replace(/[\u0000-\u001F\s]/g, '');
  if (name === 'href') return LINK.test(address);
  if (name === 'src') return tag === 'img' && IMAGE.test(address);
  return true;
}

function cleanStyle(element: HTMLElement): void {
  const kept = STYLES
    .map(property => [property, element.style.getPropertyValue(property)] as const)
    .filter(([, value]) => value && !/url\(|expression|var\(/i.test(value))
    .map(([property, value]) => `${property}: ${value}`);
  if (kept.length) element.setAttribute('style', kept.join('; '));
  else element.removeAttribute('style');
}
