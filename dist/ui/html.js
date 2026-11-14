import { effect } from "../reactive/reactive.js";
import { sanitizeHtml } from "./sanitize.js";
import { jsx } from "../jsx-runtime.js";
// src/ui/html.tsx
/**
* HTML written by users (comments from an editor, content of a CMS) in a template. Like |noescape in Latte,
* but cleaned first: only allowed tags and attributes stay, links and images only with safe addresses.
* Text is still written as {text}, which needs no cleaning; <Html> is only for HTML.
*/
/** <Html html={() => comment().text} class="comment-text" />: cleaned HTML, shown again when it changes. */
function Html(props) {
	const Tag = props.tag ?? "div";
	return /* @__PURE__ */ jsx(Tag, {
		class: props.class,
		ref: (element) => effect(() => {
			const html = typeof props.html === "function" ? props.html() : props.html;
			element.innerHTML = sanitizeHtml(html ?? "", props.options);
		})
	});
}
export { Html };
