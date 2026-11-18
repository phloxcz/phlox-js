import { Else, For, If } from "../ui/flow.js";
import { computed, effect, getScope, state, untrack } from "../reactive/reactive.js";
import { APP } from "../ui/component.js";
import { classes, currentTheme } from "../ui/theme.js";
import { followPointer } from "../ui/drag.js";
import { allowsMotion } from "../ui/motion.js";
import { foldText } from "../forms/listbox.js";
import { Tree } from "./tree.js";
import { jsx } from "../jsx-runtime.js";
// src/components/treeview.tsx
/**
* Drawing of a Tree, with the HTML and classes of phloxcz/components-tree, the keyboard of the WAI-ARIA tree
* pattern, and moving of nodes by dragging (pointer events, so also with a pen; on a touch screen a swipe scrolls).
*/
var TOGGLE_ICON = "<svg class=\"pt-toggle__icon\" viewBox=\"0 0 16 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 4l4 4-4 4\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>";
/** The pointer must move this far before a press becomes dragging, so a click stays a click. */
var DRAG_THRESHOLD = 4;
/** How long a collapsed node waits under a dragged one before it opens. */
var OPEN_DELAY = 600;
/** Where the copy of a dragged row is, from the pointer. */
var GHOST_OFFSET = {
	x: 14,
	y: 10
};
/** A finger must stay this long and move less than this to start dragging; otherwise it scrolls. */
var HOLD_DELAY = 400;
var HOLD_TOLERANCE = 8;
var noMenu = (event) => event.preventDefault();
function TreeView(props) {
	const { tree } = props;
	const theme = currentTheme();
	const slot = (part) => theme.class(`tree.${part}`);
	const app = getScope()?.find(APP);
	const fail = (error) => app ? app.onError(error) : console.error(error);
	const pick = tree.options.pick;
	const items = /* @__PURE__ */ new WeakMap();
	tree.load().catch(fail);
	const focused = state(null);
	const tabStop = computed(() => {
		const visible = tree.visible();
		const current = focused();
		if (current && visible.includes(current)) return current;
		return visible.find((item) => item.id === tree.selected() || pick && tree.checked().includes(item.id)) ?? visible[0] ?? null;
	});
	const focus = (item) => {
		if (!item) return;
		focused.set(item);
		item.element?.focus();
	};
	/** What a click or Enter on a node does: picks it, or selects it and follows its link. */
	const activate = (item, viaLink = false) => {
		if (item.node.disabled) return;
		if (pick) return tree.check(item);
		tree.choose(item);
		if (props.href && !viaLink) item.element?.querySelector(":scope > .pt-row > a.pt-label")?.click();
	};
	let typed = "";
	let typedAt = 0;
	const typeAhead = (char, from) => {
		typed = Date.now() - typedAt > 500 ? char : typed + char;
		typedAt = Date.now();
		const visible = tree.visible();
		const start = visible.indexOf(from);
		const order = [...visible.slice(start + (typed.length === 1 ? 1 : 0)), ...visible.slice(0, start)];
		focus(order.find((item) => foldText(item.node.label).startsWith(foldText(typed))));
	};
	const onKeydown = (event) => {
		const item = items.get(event.target.closest(".pt-item"));
		if (!item || event.altKey || event.ctrlKey || event.metaKey) return;
		const visible = tree.visible();
		const at = visible.indexOf(item);
		const handled = () => event.preventDefault();
		switch (event.key) {
			case "ArrowDown":
				handled();
				focus(visible[at + 1]);
				break;
			case "ArrowUp":
				handled();
				focus(visible[at - 1]);
				break;
			case "Home":
				handled();
				focus(visible[0]);
				break;
			case "End":
				handled();
				focus(visible.at(-1));
				break;
			case "ArrowRight":
				handled();
				if (!item.hasChildren()) break;
				if (untrack(item.expanded)) focus(untrack(item.children)?.[0]);
				else tree.expand(item).catch(fail);
				break;
			case "ArrowLeft":
				handled();
				if (untrack(item.expanded)) tree.collapse(item);
				else focus(untrack(item.parent));
				break;
			case "Enter":
			case " ":
				handled();
				activate(item);
				break;
			case "*":
				handled();
				for (const sibling of (untrack(item.parent) ? untrack(untrack(item.parent).children) : untrack(tree.roots)) ?? []) tree.expand(sibling).catch(fail);
				break;
			default: if (event.key.length === 1 && event.key.trim()) {
				handled();
				typeAhead(event.key, item);
			}
		}
	};
	const dragged = state(null);
	const drop = state(null);
	let root;
	const startDrag = (event, item, row) => {
		if (event.button !== 0 || !tree.canDrag(item)) return;
		if (event.pointerType === "touch") holdToDrag(event, item, row);
		else dragFrom(event, item, row);
	};
	const holdToDrag = (event, item, row) => {
		const pointer = event.pointerId;
		const stop = () => {
			clearTimeout(timer);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onEnd);
			window.removeEventListener("pointercancel", onEnd);
			window.removeEventListener("contextmenu", noMenu, true);
		};
		const onMove = (move) => {
			if (move.pointerId === pointer && Math.hypot(move.clientX - event.clientX, move.clientY - event.clientY) > HOLD_TOLERANCE) stop();
		};
		const onEnd = (end) => {
			if (end.pointerId === pointer) stop();
		};
		const timer = setTimeout(() => {
			stop();
			navigator.vibrate?.(15);
			dragFrom(event, item, row, true);
		}, HOLD_DELAY);
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onEnd);
		window.addEventListener("pointercancel", onEnd);
		window.addEventListener("contextmenu", noMenu, true);
	};
	const dragFrom = (event, item, row, touch = false) => {
		const start = {
			x: event.clientX,
			y: event.clientY
		};
		const box = row.getBoundingClientRect();
		let ghost = null;
		let opening = null;
		const stopOpening = () => {
			if (opening) clearTimeout(opening.timer);
			opening = null;
		};
		const move = (pointer) => {
			if (!ghost) {
				if (!touch && Math.hypot(pointer.x - start.x, pointer.y - start.y) < DRAG_THRESHOLD) return;
				ghost = document.createElement("div");
				ghost.className = "phlox-tree pt-ghost";
				ghost.style.maxWidth = `${box.width}px`;
				ghost.append(row.cloneNode(true));
				document.body.append(ghost);
				dragged.set(item);
			}
			ghost.style.transform = `translate(${pointer.x + GHOST_OFFSET.x}px, ${pointer.y + GHOST_OFFSET.y}px)`;
			const element = document.elementFromPoint?.(pointer.x, pointer.y)?.closest(".pt-item");
			const target = element && root.contains(element) ? items.get(element) : void 0;
			if (!target) {
				drop.set(null);
				return stopOpening();
			}
			const targetRow = target.element.querySelector(":scope > .pt-row").getBoundingClientRect();
			const share = (pointer.y - targetRow.top) / targetRow.height;
			const position = share < .28 ? "before" : share > .72 ? "after" : "child";
			const current = untrack(drop);
			if (current?.item !== target || current.position !== position) drop.set(tree.canDrop(item, target, position) ? {
				item: target,
				position
			} : null);
			if (position === "child" && target.hasChildren() && !untrack(target.expanded)) {
				if (opening?.item !== target) {
					stopOpening();
					opening = {
						item: target,
						timer: setTimeout(() => void tree.expand(target).catch(fail), OPEN_DELAY)
					};
				}
			} else stopOpening();
		};
		const noScroll = (touchmove) => touchmove.preventDefault();
		if (touch) {
			window.addEventListener("touchmove", noScroll, { passive: false });
			window.addEventListener("contextmenu", noMenu, true);
		}
		followPointer(event, root, {
			move,
			end: (cancelled) => {
				window.removeEventListener("touchmove", noScroll);
				window.removeEventListener("contextmenu", noMenu, true);
				stopOpening();
				const target = untrack(drop);
				ghost?.remove();
				dragged.set(null);
				drop.set(null);
				if (ghost && !cancelled && target) tree.move(item, target.item, target.position).catch(fail);
				if (ghost) {
					const swallow = (click) => click.stopPropagation();
					window.addEventListener("click", swallow, true);
					setTimeout(() => window.removeEventListener("click", swallow, true));
				}
			}
		});
		if (touch) move(start);
	};
	/** How long nodes slide open and closed: --pt-anim-duration, nothing when animations are off (setMotion). */
	const duration = () => {
		if (!allowsMotion()) return 0;
		const value = getComputedStyle(root).getPropertyValue("--pt-anim-duration").trim();
		if (!value) return 0;
		return value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1e3;
	};
	const slide = (element, from, to) => {
		const ms = duration();
		if (!ms || typeof element.animate !== "function") return null;
		return element.animate([{ height: `${from}px` }, { height: `${to}px` }], {
			duration: ms,
			easing: "cubic-bezier(0.4, 0, 0.2, 1)"
		});
	};
	const indents = (item) => () => {
		return item.ancestors().slice(1).map((ancestor) => /* @__PURE__ */ jsx("span", {
			class: "pt-indent",
			"data-has-line": isLast(ancestor) ? "0" : "1",
			"aria-hidden": "true"
		}));
	};
	const isLast = (item) => {
		const parent = item.parent();
		return ((parent ? parent.children() : tree.roots()) ?? []).at(-1) === item;
	};
	const Node = (item) => {
		const node = item.node;
		const selected = () => !pick && tree.selected() === item.id;
		const checked = () => tree.checked().includes(item.id);
		const level = () => item.ancestors().length;
		const open = () => item.expanded() && item.hasChildren();
		const shown = state(untrack(open));
		let box = null;
		let sliding = null;
		let ready = false;
		effect(() => {
			const now = open();
			untrack(() => {
				const height = box?.offsetHeight ?? 0;
				sliding?.cancel();
				sliding = null;
				if (now) return shown.set(true);
				sliding = box && shown() ? slide(box, height, 0) : null;
				if (sliding) sliding.onfinish = () => shown.set(false);
				else shown.set(false);
			});
		});
		const view = /* @__PURE__ */ jsx("li", {
			class: () => classes("pt-item", item.expanded() && item.hasChildren() && "is-expanded", item.hasChildren() ? "has-children" : "is-leaf", node.disabled && "is-disabled", isLast(item) && "is-last", selected() && "is-selected", dragged() === item && "is-dragging"),
			"data-id": String(node.id),
			role: "treeitem",
			"aria-level": () => level() + 1,
			"aria-expanded": () => item.hasChildren() ? String(item.expanded()) : null,
			"aria-selected": () => pick ? null : String(selected()),
			"aria-checked": () => pick ? String(checked()) : null,
			"aria-disabled": node.disabled ? "true" : null,
			"aria-busy": () => item.loading() ? "true" : null,
			tabIndex: () => tabStop() === item ? 0 : -1,
			"data-drop-pos": () => drop()?.item === item ? drop().position : null,
			ref: (element) => {
				item.element = element;
				items.set(element, item);
			},
			onFocusin: (event) => {
				if (event.target === event.currentTarget) focused.set(item);
			},
			children: [/* @__PURE__ */ jsx("div", {
				class: () => classes("pt-row", slot("row"), selected() && slot("rowSelected")),
				onPointerdown: (event) => startDrag(event, item, event.currentTarget),
				onClick: (event) => {
					const target = event.target;
					if (target.closest(".pt-toggle")) return;
					focus(item);
					if (target.closest("a.pt-label")) return activate(item, true);
					if (target.closest(".pt-pick")) return;
					activate(item);
				},
				children: [
					indents(item),
					() => level() > 0 ? /* @__PURE__ */ jsx("span", {
						class: classes("pt-connector", isLast(item) && "pt-connector--last"),
						"aria-hidden": "true"
					}) : null,
					/* @__PURE__ */ jsx(If, {
						when: () => item.hasChildren(),
						children: [
							/* @__PURE__ */ jsx("button", {
								type: "button",
								class: classes("pt-toggle", slot("toggle")),
								tabIndex: -1,
								"aria-label": () => item.expanded() ? Tree.texts.collapse : Tree.texts.expand,
								ref: (element) => {
									element.innerHTML = TOGGLE_ICON;
								},
								onClick: () => void tree.toggle(item).catch(fail)
							}),
							/* @__PURE__ */ jsx(Else, {}),
							/* @__PURE__ */ jsx("span", { class: "pt-toggle pt-toggle--leaf" })
						]
					}),
					pick ? /* @__PURE__ */ jsx("input", {
						class: classes("pt-pick", pick === "multiple" ? "pt-checkbox" : "pt-radio", slot("pick")),
						type: pick === "multiple" ? "checkbox" : "radio",
						name: props.name ? pick === "multiple" ? `${props.name}[]` : props.name : null,
						value: String(node.id),
						checked,
						disabled: () => Boolean(node.disabled) || tree.locked() === "disabled",
						tabIndex: -1,
						"aria-hidden": "true",
						onClick: (event) => untrack(tree.locked) && event.preventDefault(),
						onChange: (event) => tree.check(item, event.currentTarget.checked)
					}) : null,
					props.icon ? /* @__PURE__ */ jsx("span", {
						class: "pt-icon",
						children: props.icon(node, item)
					}) : null,
					props.href ? /* @__PURE__ */ jsx("a", {
						class: classes("pt-label", slot("label")),
						href: props.href(node),
						tabIndex: -1,
						draggable: false,
						children: props.label ? props.label(node) : node.label
					}) : /* @__PURE__ */ jsx("span", {
						class: classes("pt-label", slot("label")),
						children: props.label ? props.label(node) : node.label
					}),
					/* @__PURE__ */ jsx(If, {
						when: item.loading,
						children: /* @__PURE__ */ jsx("span", {
							class: "pt-spinner",
							role: "status",
							"aria-label": Tree.texts.loading
						})
					})
				]
			}), /* @__PURE__ */ jsx(If, {
				when: shown,
				children: /* @__PURE__ */ jsx("div", {
					class: "pt-children",
					ref: (element) => {
						box = element;
						if (ready) queueMicrotask(() => {
							sliding = slide(element, 0, element.scrollHeight);
						});
					},
					children: /* @__PURE__ */ jsx("ul", {
						class: "pt-list",
						role: "group",
						children: /* @__PURE__ */ jsx(For, {
							each: () => item.children() ?? [],
							children: (child) => Node(child)
						})
					})
				})
			})]
		});
		ready = true;
		return view;
	};
	return /* @__PURE__ */ jsx("div", {
		class: classes("phlox-tree", props.lines && "phlox-tree--lines", slot("root"), props.class),
		"data-phlox-tree": true,
		ref: (element) => {
			root = element;
		},
		children: /* @__PURE__ */ jsx("ul", {
			...props.attributes,
			class: "pt-list",
			role: "tree",
			"aria-label": props["aria-label"] ?? null,
			"aria-multiselectable": pick === "multiple" ? "true" : null,
			tabIndex: -1,
			onKeydown,
			onFocus: (event) => {
				if (event.target === event.currentTarget) focus(untrack(tabStop));
			},
			children: /* @__PURE__ */ jsx(For, {
				each: tree.roots,
				children: (item) => Node(item)
			})
		})
	});
}
export { TreeView };
