// src/ui/sanitize.ts
var GLOBAL = ["title", "style"];
/** The allowed tags and their own attributes. */
var TAGS = {
	p: [],
	br: [],
	strong: [],
	b: [],
	em: [],
	i: [],
	u: [],
	s: [],
	sub: [],
	sup: [],
	small: [],
	mark: [],
	span: [],
	div: [],
	h1: [],
	h2: [],
	h3: [],
	h4: [],
	h5: [],
	h6: [],
	blockquote: [],
	pre: [],
	code: [],
	hr: [],
	ul: [],
	ol: ["start"],
	li: [],
	figure: [],
	figcaption: [],
	table: [],
	caption: [],
	thead: [],
	tbody: [],
	tfoot: [],
	tr: [],
	th: ["colspan", "rowspan"],
	td: ["colspan", "rowspan"],
	a: ["href", "target"],
	img: [
		"src",
		"alt",
		"width",
		"height"
	]
};
/** Removed with their content; other unknown tags are replaced by their content. */
var DROPPED = /* @__PURE__ */ new Set([
	"script",
	"style",
	"template",
	"noscript",
	"iframe",
	"object",
	"embed",
	"svg",
	"math",
	"form",
	"input",
	"button",
	"select",
	"textarea",
	"link",
	"meta",
	"base",
	"title",
	"head"
]);
/** CSS properties that can only change the look of the text, not cover or move the page. */
var STYLES = [
	"color",
	"background-color",
	"text-align",
	"font-weight",
	"font-style",
	"text-decoration",
	"width",
	"height"
];
var LINK = /^(https?:|mailto:|tel:|#|\/|\.|[^:]*$)/i;
var IMAGE = /^(https?:|\/|\.|data:image\/(png|jpeg|gif|webp);|[^:]*$)/i;
/** The HTML with only allowed tags, attributes and addresses. Works on a server too, with options.document. */
function sanitizeHtml(html, options = {}) {
	const template = (options.document ?? document).implementation.createHTMLDocument("").createElement("template");
	template.innerHTML = html;
	const tags = {
		...TAGS,
		...options.tags
	};
	clean(template.content, tags, options.classes ?? false);
	return template.innerHTML;
}
function clean(parent, tags, classes) {
	for (const node of [...parent.childNodes]) {
		if (node.nodeType === 3) continue;
		if (node.nodeType !== 1) {
			node.remove();
			continue;
		}
		const element = node;
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
		for (const { name, value } of [...element.attributes]) if (!(GLOBAL.includes(name) || allowed.includes(name) || classes && name === "class") || !safeValue(tag, name, value)) element.removeAttribute(name);
		if (element.hasAttribute("style")) cleanStyle(element);
		if (tag === "a" && element.hasAttribute("target")) {
			element.setAttribute("target", "_blank");
			element.setAttribute("rel", "noopener noreferrer");
		}
	}
}
function safeValue(tag, name, value) {
	const address = value.trim().replace(/[\u0000-\u001F\s]/g, "");
	if (name === "href") return LINK.test(address);
	if (name === "src") return tag === "img" && IMAGE.test(address);
	return true;
}
function cleanStyle(element) {
	const kept = STYLES.map((property) => [property, element.style.getPropertyValue(property)]).filter(([, value]) => value && !/url\(|expression|var\(/i.test(value)).map(([property, value]) => `${property}: ${value}`);
	if (kept.length) element.setAttribute("style", kept.join("; "));
	else element.removeAttribute("style");
}
export { sanitizeHtml };
