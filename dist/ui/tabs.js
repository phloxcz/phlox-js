import { effect, onCleanup, state, untrack } from "../reactive/reactive.js";
import { templateOf } from "./dom.js";
import { Dropdown, DropdownItem } from "./dropdown.js";
import { REVEAL } from "./reveal.js";
import { texts } from "./texts.js";
import { classes, currentTheme } from "./theme.js";
import { jsx } from "../jsx-runtime.js";
// src/ui/tabs.tsx
/**
* Tabs: a row of tabs over panels, only the panel of the chosen tab is visible.
*
*   <Tabs>
*     <Tab title="Název a popis">…</Tab>
*     <Tab title="Varianty">…</Tab>
*   </Tabs>
*
* The panels stay in the page when hidden, so the controls of a form in them keep their values and are
* validated. A control that gets the focus from a hidden panel (the first error after a failed validation)
* switches to its tab, and a tab with an error in its panel has a mark. Tabs that do not fit are behind "More".
*/
var tabsTexts = texts("tabs", {
	more: "More",
	hasErrors: "contains an error"
});
/** A tab of <Tabs>, it can be used only directly inside it. */
function Tab(_props) {
	throw new Error("<Tab> can be used only directly inside <Tabs>.");
}
/**
* Which tabs are shown when they need `widths` and there is `available` room: as many from the start as fit
* next to the button "More" (`moreWidth`). The chosen one is shown always, instead of the last that fits.
*/
function fitTabs(widths, available, moreWidth, selected) {
	if (widths.reduce((sum, width) => sum + width, 0) <= available) return widths.map(() => true);
	const room = available - moreWidth - (widths[selected] ?? 0);
	const shown = widths.map((_, index) => index === selected);
	let used = 0;
	for (let index = 0; index < widths.length; index++) {
		if (index === selected) continue;
		used += widths[index];
		if (used > room) break;
		shown[index] = true;
	}
	return shown;
}
var lastId = 0;
function Tabs(props) {
	const theme = currentTheme();
	const tabs = (Array.isArray(props.children) ? props.children : [props.children]).filter((child) => child != null && child !== false).map((child) => {
		const template = templateOf(child);
		if (template?.tag !== Tab) throw new Error("<Tabs> may contain only <Tab> elements.");
		return {
			...template.props,
			children: template.children
		};
	});
	const selected = props.selected ?? state(0);
	const shown = state(tabs.map(() => true));
	const invalid = state(tabs.map(() => false));
	const id = `phlox-tabs-${++lastId}`;
	const buttons = [];
	let nav;
	let more;
	const choose = (index, focus = false) => {
		selected.set(index);
		if (focus) buttons[index]?.focus();
	};
	const keydown = (event) => {
		const order = tabs.map((_, index) => index).filter((index) => untrack(shown)[index]);
		const at = order.indexOf(untrack(selected));
		const next = {
			ArrowRight: order[(at + 1) % order.length],
			ArrowLeft: order[(at - 1 + order.length) % order.length],
			Home: order[0],
			End: order.at(-1)
		}[event.key];
		if (next === void 0) return;
		event.preventDefault();
		choose(next, true);
	};
	const measure = () => {
		if (!nav?.isConnected || !more) return;
		for (const button of buttons) button.hidden = false;
		more.hidden = false;
		const widths = buttons.map((button) => button.getBoundingClientRect().width);
		shown.set(fitTabs(widths, nav.clientWidth, more.getBoundingClientRect().width, untrack(selected)));
	};
	if (typeof ResizeObserver !== "undefined") {
		const observer = new ResizeObserver(() => measure());
		queueMicrotask(() => nav && observer.observe(nav));
		onCleanup(() => observer.disconnect());
	}
	effect(() => {
		if (!shown()[selected()]) untrack(measure);
	});
	/** A panel: switches to its tab when something inside it asks to be shown, marks its tab when it has an error. */
	const watch = (panel, index) => {
		panel.addEventListener(REVEAL, () => choose(index));
		const update = () => {
			const has = panel.querySelector("[aria-invalid=\"true\"]") !== null;
			if (untrack(invalid)[index] !== has) invalid.set(untrack(invalid).map((value, at) => at === index ? has : value));
		};
		const observer = new MutationObserver(update);
		observer.observe(panel, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ["aria-invalid"]
		});
		onCleanup(() => observer.disconnect());
		update();
	};
	return /* @__PURE__ */ jsx("div", {
		class: classes(theme.class("tabs"), props.class),
		children: [/* @__PURE__ */ jsx("div", {
			class: theme.class("tabs.nav"),
			ref: (element) => {
				nav = element;
			},
			children: [/* @__PURE__ */ jsx("div", {
				role: "tablist",
				class: "phlox-tablist",
				"aria-label": props["aria-label"] ?? null,
				onKeydown: keydown,
				children: tabs.map((tab, index) => /* @__PURE__ */ jsx("button", {
					type: "button",
					role: "tab",
					id: `${id}-tab-${index}`,
					"aria-controls": `${id}-panel-${index}`,
					"aria-selected": () => String(selected() === index),
					tabIndex: () => selected() === index ? 0 : -1,
					hidden: () => !shown()[index],
					class: () => classes(theme.class("tabs.tab"), selected() === index && theme.class("tabs.tabActive")),
					ref: (element) => {
						buttons[index] = element;
					},
					onClick: () => choose(index),
					children: [tab.title, () => invalid()[index] ? /* @__PURE__ */ jsx("span", {
						class: "phlox-tab-error",
						children: /* @__PURE__ */ jsx("span", {
							class: "phlox-visually-hidden",
							children: tabsTexts.hasErrors
						})
					}) : null]
				}))
			}), /* @__PURE__ */ jsx("div", {
				class: "phlox-tabs-more",
				hidden: () => shown().every(Boolean),
				ref: (element) => {
					more = element;
				},
				children: /* @__PURE__ */ jsx(Dropdown, {
					class: theme.class("tabs.more"),
					label: tabsTexts.more,
					placement: "bottom-right",
					children: () => tabs.map((tab, index) => untrack(shown)[index] ? null : /* @__PURE__ */ jsx(DropdownItem, {
						onClick: () => choose(index),
						children: tab.title
					}))
				})
			})]
		}), tabs.map((tab, index) => /* @__PURE__ */ jsx("div", {
			role: "tabpanel",
			id: `${id}-panel-${index}`,
			"aria-labelledby": `${id}-tab-${index}`,
			class: theme.class("tabs.panel"),
			hidden: () => selected() !== index,
			ref: (element) => watch(element, index),
			children: tab.children
		}))]
	});
}
export { Tab, Tabs, fitTabs, tabsTexts };
