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
/** The HTML with only allowed tags, attributes and addresses. Works on a server too, with options.document. */
export declare function sanitizeHtml(html: string, options?: SanitizeOptions): string;
