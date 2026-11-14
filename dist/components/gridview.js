import { Else, For, If } from "../ui/flow.js";
import { Fragment } from "../ui/dom.js";
import { effect, getScope, onCleanup, state, untrack } from "../reactive/reactive.js";
import { APP } from "../ui/component.js";
import { classes, currentTheme } from "../ui/theme.js";
import { followPointer } from "../ui/drag.js";
import { Form } from "../forms/form.js";
import { DropDownList } from "../forms/dropdownlist.js";
import { Grid } from "./grid.js";
import { jsx } from "../jsx-runtime.js";
// src/components/gridview.tsx
/**
* Drawing of a Grid with the HTML and classes of phloxcz/components-grid: a toolbar with search and columns,
* a bar for selected rows, the table with sorting, filters, actions and totals, and pages below it.
*/
var ICONS = {
	asc: "<svg viewBox=\"0 0 16 16\" width=\"10\" height=\"10\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M8 4l5 7H3z\"/></svg>",
	desc: "<svg viewBox=\"0 0 16 16\" width=\"10\" height=\"10\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M8 12L3 5h10z\"/></svg>",
	none: "<svg viewBox=\"0 0 16 16\" width=\"10\" height=\"10\" fill=\"currentColor\" aria-hidden=\"true\" opacity=\".4\"><path d=\"M8 2l4 5H4zM8 14l-4-5h8z\"/></svg>",
	clear: "<svg viewBox=\"0 0 16 16\" width=\"10\" height=\"10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" aria-hidden=\"true\"><path d=\"M3 3l10 10M13 3L3 13\"/></svg>",
	menu: "<svg viewBox=\"0 0 16 16\" width=\"14\" height=\"14\" fill=\"currentColor\" aria-hidden=\"true\"><circle cx=\"8\" cy=\"3\" r=\"1.5\"/><circle cx=\"8\" cy=\"8\" r=\"1.5\"/><circle cx=\"8\" cy=\"13\" r=\"1.5\"/></svg>"
};
/** Puts a fixed SVG into an element, the renderer makes no SVG. */
var icon = (svg) => (element) => {
	element.innerHTML = svg;
};
/** The pointer must move this far before a press on a header becomes moving the column. */
var DRAG_THRESHOLD = 5;
/** How long typing waits before it searches or filters. */
var TYPING_DELAY = 400;
var format = (text, ...values) => {
	let next = 0;
	return text.replace(/%[ds]/g, () => String(values[next++] ?? ""));
};
/**
* A panel under a button (a filter, a menu): placed `fixed`, so a table that scrolls does not cut it,
* moved left when it would leave the window, above the button when there is no room below.
*/
function placePopup(anchor, panel) {
	const update = () => {
		const box = anchor.getBoundingClientRect();
		Object.assign(panel.style, {
			display: "block",
			position: "fixed",
			margin: "0",
			zIndex: "1070",
			right: "auto",
			bottom: "auto"
		});
		const left = Math.max(8, Math.min(box.left, window.innerWidth - panel.offsetWidth - 8));
		const below = window.innerHeight - box.bottom;
		const top = below < panel.offsetHeight + 4 && box.top > below ? box.top - panel.offsetHeight - 2 : box.bottom + 2;
		Object.assign(panel.style, {
			left: `${left}px`,
			top: `${top}px`
		});
	};
	update();
	if (typeof requestAnimationFrame === "function") requestAnimationFrame(update);
	window.addEventListener("scroll", update, true);
	window.addEventListener("resize", update);
	onCleanup(() => {
		window.removeEventListener("scroll", update, true);
		window.removeEventListener("resize", update);
	});
}
/** A button with a panel that closes by Escape, by a click outside or when the focus leaves it. */
function Popup(props) {
	const opened = state(false);
	let wrapper;
	const close = () => {
		opened.set(false);
		wrapper.querySelector(":scope > button")?.focus();
	};
	const outside = (event) => {
		if (!wrapper.contains(event.target)) opened.set(false);
	};
	effect(() => {
		if (!opened()) return;
		document.addEventListener("pointerdown", outside, true);
		return () => document.removeEventListener("pointerdown", outside, true);
	});
	return /* @__PURE__ */ jsx("div", {
		class: "phx-grid-ms-wrap",
		ref: (element) => {
			wrapper = element;
		},
		onFocusout: (event) => {
			if (!wrapper.contains(event.relatedTarget) && event.relatedTarget) opened.set(false);
		},
		onKeydown: (event) => {
			if (event.key !== "Escape" || !untrack(opened)) return;
			event.preventDefault();
			event.stopPropagation();
			close();
		},
		children: [props.button(() => opened.update((open) => !open), opened), /* @__PURE__ */ jsx(If, {
			when: opened,
			children: /* @__PURE__ */ jsx("div", {
				class: props.class,
				role: "dialog",
				"aria-label": props.label ?? null,
				ref: (panel) => {
					placePopup(wrapper.querySelector(":scope > button"), panel);
					queueMicrotask(() => panel.querySelector("input, select, button, a")?.focus());
				},
				children: props.panel(close)
			})
		})]
	});
}
function GridView(props) {
	const { grid } = props;
	const theme = currentTheme();
	const slot = (part) => theme.class(`grid.${part}`);
	const texts = Grid.texts;
	const app = getScope()?.find(APP);
	const fail = (error) => app ? app.onError(error) : console.error(error);
	const run = (work) => void work.catch(fail);
	const filterForm = new Form();
	grid.follow();
	if (app) grid.ask = (question, anchor, danger) => app.confirm(question, {
		...anchor ? {
			anchor,
			placement: "bottom-right"
		} : {},
		danger: Boolean(danger)
	});
	if (!untrack(() => grid.loading())) run(grid.loadOnce());
	const hasFilters = () => grid.visibleColumns().some((column) => column.filterKind);
	const hasBulk = grid.bulkActions.length > 0;
	const hasActions = grid.actions.length > 0;
	const hasFooter = grid.columns.some((column) => column.aggregateFn);
	const span = () => grid.visibleColumns().length + (hasBulk ? 1 : 0) + (hasActions ? 1 : 0);
	const filtered = () => grid.search() !== "" || Object.keys(grid.filters()).length > 0;
	const typing = (apply) => {
		let timer;
		onCleanup(() => clearTimeout(timer));
		return {
			onInput: (event) => {
				clearTimeout(timer);
				const text = event.currentTarget.value;
				timer = setTimeout(() => run(apply(text)), TYPING_DELAY);
			},
			onKeydown: (event) => {
				if (event.key !== "Enter") return;
				event.preventDefault();
				clearTimeout(timer);
				run(apply(event.currentTarget.value));
			}
		};
	};
	const toolbar = /* @__PURE__ */ jsx("div", {
		class: "phx-grid-header",
		children: /* @__PURE__ */ jsx("div", {
			class: classes(slot("toolbar"), "phx-grid-toolbar-gap"),
			children: [
				props.search ? /* @__PURE__ */ jsx("div", {
					class: classes(slot("searchGroup"), "phx-grid-search-group"),
					children: /* @__PURE__ */ jsx("input", {
						type: "search",
						class: classes(slot("searchInput"), "phx-grid-search-input"),
						placeholder: texts.search,
						"aria-label": texts.search,
						autocomplete: "off",
						value: grid.search,
						...typing((text) => grid.setSearch(text))
					})
				}) : null,
				/* @__PURE__ */ jsx(If, {
					when: filtered,
					children: /* @__PURE__ */ jsx("button", {
						type: "button",
						class: slot("resetBtn"),
						onClick: () => run(grid.reset()),
						children: [
							/* @__PURE__ */ jsx("span", { ref: icon(ICONS.clear) }),
							" ",
							texts.reset
						]
					})
				}),
				props.columnToggle ? columnToggle() : null
			]
		})
	});
	function columnToggle() {
		return /* @__PURE__ */ jsx("div", {
			class: "phx-grid-coltoggle-wrap",
			children: /* @__PURE__ */ jsx(Popup, {
				class: classes(slot("colToggleDropdown"), "phx-grid-coltoggle-menu"),
				label: texts.columns,
				button: (open, opened) => /* @__PURE__ */ jsx("button", {
					type: "button",
					class: slot("colToggleBtn"),
					"aria-haspopup": "dialog",
					"aria-expanded": () => String(opened()),
					onClick: open,
					children: texts.columns
				}),
				panel: () => /* @__PURE__ */ jsx(For, {
					each: () => [...grid.visibleColumns(), ...grid.columns.filter((column) => !grid.visibleColumns().includes(column))],
					children: (column) => /* @__PURE__ */ jsx("div", {
						class: classes(slot("colToggleItem"), "phx-grid-coltoggle-item"),
						children: [
							/* @__PURE__ */ jsx("label", {
								class: "phx-grid-coltoggle-label",
								children: [/* @__PURE__ */ jsx("input", {
									type: "checkbox",
									class: classes(slot("colToggleCheck"), "phx-grid-coltoggle-check"),
									checked: () => !grid.hidden().includes(column.key),
									disabled: !column.canHide,
									onChange: (event) => grid.toggleColumn(column.key, event.currentTarget.checked)
								}), /* @__PURE__ */ jsx("span", { children: column.label })]
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								class: "phx-grid-coltoggle-move",
								"aria-label": `${texts.moveLeft}: ${column.label}`,
								title: texts.moveLeft,
								onClick: () => grid.shiftColumn(column.key, -1),
								children: "←"
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								class: "phx-grid-coltoggle-move",
								"aria-label": `${texts.moveRight}: ${column.label}`,
								title: texts.moveRight,
								onClick: () => grid.shiftColumn(column.key, 1),
								children: "→"
							})
						]
					})
				})
			})
		});
	}
	const bulkBar = hasBulk ? /* @__PURE__ */ jsx(If, {
		when: () => grid.selected().length > 0,
		children: /* @__PURE__ */ jsx("div", {
			class: classes("phx-grid-bulk-bar", slot("bulkBar")),
			role: "region",
			"aria-label": texts.actions,
			children: [/* @__PURE__ */ jsx("span", {
				class: classes(slot("bulkCount"), "phx-grid-bulk-bar-count"),
				children: () => format(texts.selected, grid.selected().length)
			}), grid.bulkActions.map((action) => /* @__PURE__ */ jsx("button", {
				type: "button",
				class: classes(slot("bulkBtn"), action.danger && slot("danger")),
				onClick: (event) => run(grid.runBulk(action, event.currentTarget)),
				children: action.label
			}))]
		})
	}) : null;
	const clearButton = (column) => /* @__PURE__ */ jsx("button", {
		type: "button",
		class: classes(slot("filterClear"), "phx-grid-filter-clear"),
		title: texts.clearFilter,
		"aria-label": `${texts.clearFilter}: ${column.label}`,
		tabIndex: -1,
		disabled: () => grid.filters()[column.key] === void 0,
		ref: icon(ICONS.clear),
		onClick: () => run(grid.setFilter(column.key, null))
	});
	const valueOf = (column) => () => {
		const value = grid.filters()[column.key];
		return typeof value === "string" ? value : "";
	};
	function filterControl(column) {
		const label = `${texts.filter}: ${column.label}`;
		switch (column.filterKind) {
			case "text": return /* @__PURE__ */ jsx("input", {
				type: "text",
				class: slot("filterInput"),
				placeholder: texts.filter,
				"aria-label": label,
				autocomplete: "off",
				value: valueOf(column),
				...typing((text) => grid.setFilter(column.key, text.trim()))
			});
			case "select":
			case "bool": {
				const items = column.filterKind === "bool" ? [["1", texts.yes], ["0", texts.no]] : column.filterItems.map(([value, text]) => [String(value), text]);
				return /* @__PURE__ */ jsx("select", {
					class: slot("filterSelect"),
					"aria-label": label,
					onChange: (event) => run(grid.setFilter(column.key, event.currentTarget.value)),
					children: [/* @__PURE__ */ jsx("option", {
						value: "",
						selected: () => valueOf(column)() === "",
						children: texts.all
					}), items.map(([value, text]) => /* @__PURE__ */ jsx("option", {
						value,
						selected: () => valueOf(column)() === value,
						children: text
					}))]
				});
			}
			case "multiSelect": return multiSelect(column, label);
			case "range": return range(column, label);
			case "dropDown": return dropDown(column, label);
			default: return null;
		}
	}
	function multiSelect(column, label) {
		const chosen = () => grid.filters()[column.key] ?? [];
		const draft = state([]);
		return /* @__PURE__ */ jsx(Popup, {
			class: classes(slot("msDropdown"), "phx-grid-ms-dropdown"),
			label,
			button: (open, opened) => /* @__PURE__ */ jsx("button", {
				type: "button",
				class: slot("msTrigger"),
				"aria-label": label,
				"aria-haspopup": "dialog",
				"aria-expanded": () => String(opened()),
				onClick: () => {
					draft.set(untrack(chosen));
					open();
				},
				children: /* @__PURE__ */ jsx("span", {
					class: "phx-grid-ms-label",
					children: () => {
						const labels = column.filterItems.filter(([value]) => chosen().includes(String(value))).map(([, text]) => text);
						return labels.length ? [labels[0], labels.length > 1 ? /* @__PURE__ */ jsx("span", {
							class: "phx-grid-ms-more",
							children: [" +", labels.length - 1]
						}) : null] : texts.all;
					}
				})
			}),
			panel: (close) => /* @__PURE__ */ jsx(Fragment, { children: [column.filterItems.map(([value, text]) => /* @__PURE__ */ jsx("label", {
				class: classes(slot("msItem"), "phx-grid-ms-item"),
				children: [/* @__PURE__ */ jsx("input", {
					type: "checkbox",
					class: classes(slot("msCheck"), "phx-grid-ms-check"),
					checked: () => draft().includes(String(value)),
					onChange: (event) => draft.update((list) => event.currentTarget.checked ? [...list, String(value)] : list.filter((other) => other !== String(value)))
				}), /* @__PURE__ */ jsx("span", { children: text })]
			})), /* @__PURE__ */ jsx("div", {
				class: "phx-grid-ms-footer",
				children: /* @__PURE__ */ jsx("button", {
					type: "button",
					class: slot("msApply"),
					onClick: () => {
						close();
						run(grid.setFilter(column.key, untrack(draft)));
					},
					children: texts.apply
				})
			})] })
		});
	}
	function range(column, label) {
		const parts = () => valueOf(column)().split("..");
		let from;
		let to;
		const type = column.type === "date" ? "date" : "number";
		const apply = (close) => {
			close();
			run(grid.setFilter(column.key, from.value || to.value ? `${from.value}..${to.value}` : null));
		};
		return /* @__PURE__ */ jsx(Popup, {
			class: classes(slot("msDropdown"), "phx-grid-ms-dropdown"),
			label,
			button: (open, opened) => /* @__PURE__ */ jsx("button", {
				type: "button",
				class: slot("msTrigger"),
				"aria-label": label,
				"aria-haspopup": "dialog",
				"aria-expanded": () => String(opened()),
				onClick: open,
				children: /* @__PURE__ */ jsx("span", {
					class: "phx-grid-ms-label",
					children: () => valueOf(column)() ? `${column.text(parts()[0] ? column.typed(parts()[0]) : "") || "…"} – ${column.text(parts()[1] ? column.typed(parts()[1]) : "") || "…"}` : texts.filter
				})
			}),
			panel: (close) => /* @__PURE__ */ jsx("div", {
				onKeydown: (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						apply(close);
					}
				},
				children: [/* @__PURE__ */ jsx("div", {
					class: "phx-grid-range-wrap phx-grid-range-wrap--panel",
					children: [
						/* @__PURE__ */ jsx("span", {
							class: "phx-grid-range-label",
							children: texts.from
						}),
						/* @__PURE__ */ jsx("input", {
							type,
							class: classes(slot("filterInput"), "phx-grid-range-input"),
							"aria-label": `${label}, ${texts.from}`,
							value: untrack(parts)[0] ?? "",
							ref: (element) => {
								from = element;
							}
						}),
						/* @__PURE__ */ jsx("span", {
							class: "phx-grid-range-label",
							children: texts.to
						}),
						/* @__PURE__ */ jsx("input", {
							type,
							class: classes(slot("filterInput"), "phx-grid-range-input"),
							"aria-label": `${label}, ${texts.to}`,
							value: untrack(parts)[1] ?? "",
							ref: (element) => {
								to = element;
							}
						})
					]
				}), /* @__PURE__ */ jsx("div", {
					class: "phx-grid-ms-footer",
					children: /* @__PURE__ */ jsx("button", {
						type: "button",
						class: slot("msApply"),
						onClick: () => apply(close),
						children: texts.apply
					})
				})]
			})
		});
	}
	function dropDown(column, label) {
		const control = filterForm.addControl(column.key, new DropDownList(label, {
			search: column.dropDown.search,
			...column.dropDown.label ? { label: column.dropDown.label } : {},
			placeholder: texts.all
		}));
		effect(() => {
			const value = valueOf(column)();
			untrack(() => {
				if (String(control.getValue() ?? "") !== value) control.setValue(value === "" ? null : column.typed(value));
			});
		});
		effect(() => {
			const value = control.value();
			untrack(() => {
				const text = value === null || value === void 0 ? "" : String(value);
				if (text !== valueOf(column)()) run(grid.setFilter(column.key, text || null));
			});
		});
		return /* @__PURE__ */ jsx("div", {
			class: "phx-grid-ddl",
			"aria-label": label,
			children: control.render({})
		});
	}
	let table;
	let headerRow;
	const fixed = () => Object.keys(grid.widths()).length > 0;
	/** A width in px: the remembered one, the one set in the code, or a default for a column added later. */
	const widthOf = (key, initial) => {
		const width = grid.widths()[key] ?? initial ?? "";
		const size = Number.parseFloat(width);
		if (Number.isNaN(size)) return key === "__check" ? 36 : 150;
		return /r?em$/.test(width) ? size * 16 : size;
	};
	const tableWidth = () => grid.visibleColumns().reduce((sum, column) => sum + widthOf(column.key, column.initialWidth), 0) + (hasBulk ? widthOf("__check", null) : 0) + (hasActions ? widthOf("__actions", null) : 0);
	const moving = state(null);
	const startResize = (event, column, th) => {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		if (!Object.keys(untrack(grid.widths)).length) {
			const measured = [...headerRow.querySelectorAll("th[data-width-key]")].map((cell) => [cell.dataset.widthKey, `${cell.offsetWidth}px`]);
			grid.widths.set(Object.fromEntries(measured));
		}
		const start = event.clientX;
		const width = th.offsetWidth;
		const handle = event.currentTarget;
		const tableStart = table.offsetWidth;
		handle.classList.add("phx-grid-resizing");
		table.closest(".phx-grid-wrapper")?.classList.add("phx-grid-col-resizing");
		let now = width;
		followPointer(event, table, {
			move: (pointer) => {
				now = Math.max(40, Math.round(width + pointer.x - start));
				th.style.width = `${now}px`;
				table.style.width = `${tableStart + now - width}px`;
			},
			end: (cancelled) => {
				handle.classList.remove("phx-grid-resizing");
				table.closest(".phx-grid-wrapper")?.classList.remove("phx-grid-col-resizing");
				if (!cancelled) grid.setWidth(column.key, `${now}px`);
				th.style.width = `${widthOf(column.key, column.initialWidth)}px`;
				table.style.width = `${tableWidth()}px`;
			}
		});
	};
	const startMove = (event, column) => {
		if (!props.reorderable || event.button !== 0 || event.target.closest(".phx-grid-resize-handle")) return;
		const start = event.clientX;
		let started = false;
		followPointer(event, table, {
			move: (pointer) => {
				if (!started && Math.abs(pointer.x - start) < DRAG_THRESHOLD) return;
				started = true;
				const over = document.elementFromPoint?.(pointer.x, pointer.y)?.closest("th[data-col-key]");
				if (!over || !headerRow.contains(over)) return moving.set({
					key: column.key,
					over: null,
					side: "left"
				});
				const box = over.getBoundingClientRect();
				moving.set({
					key: column.key,
					over: over.dataset.colKey,
					side: pointer.x < box.left + box.width / 2 ? "left" : "right"
				});
			},
			end: (cancelled) => {
				const target = untrack(moving);
				moving.set(null);
				if (!started) return;
				const swallow = (click) => click.stopPropagation();
				window.addEventListener("click", swallow, true);
				setTimeout(() => window.removeEventListener("click", swallow, true));
				if (cancelled || !target?.over || target.over === column.key) return;
				const keys = untrack(grid.visibleColumns).map((other) => other.key);
				const before = target.side === "left" ? target.over : keys[keys.indexOf(target.over) + 1] ?? null;
				if (before !== column.key) grid.moveColumn(column.key, before);
			}
		});
	};
	const header = (column) => {
		const sorted = () => grid.sort()?.field === column.key ? grid.sort().dir : null;
		return /* @__PURE__ */ jsx("th", {
			class: () => classes(slot("th"), `phx-grid-col-${column.key}`, column.canSort && slot("thSortable"), sorted() && slot("thSorted"), column.alignment && `phx-grid-align-${column.alignment}`, moving()?.key === column.key && "phx-grid-drag-source", moving()?.over === column.key && moving()?.key !== column.key && `phx-grid-drag-over-${moving().side}`),
			style: () => {
				const width = fixed() ? `${widthOf(column.key, column.initialWidth)}px` : column.initialWidth;
				return width ? `width:${width}` : null;
			},
			scope: "col",
			"data-col-key": column.key,
			"data-width-key": column.key,
			"aria-sort": () => column.canSort ? sorted() === "asc" ? "ascending" : sorted() === "desc" ? "descending" : "none" : null,
			onPointerdown: (event) => startMove(event, column),
			children: [column.canSort ? /* @__PURE__ */ jsx("button", {
				type: "button",
				class: slot("sortLink"),
				onClick: () => run(grid.sortBy(column.key)),
				children: [column.label, /* @__PURE__ */ jsx("span", {
					class: slot("sortIcon"),
					ref: (element) => effect(() => {
						element.innerHTML = ICONS[sorted() ?? "none"];
					})
				})]
			}) : column.label, props.resizable ? /* @__PURE__ */ jsx("div", {
				class: "phx-grid-resize-handle",
				role: "separator",
				"aria-orientation": "vertical",
				"aria-label": format(texts.resize, column.label),
				onPointerdown: (event) => startResize(event, column, event.currentTarget.parentElement)
			}) : null]
		});
	};
	const actionsCell = (row) => {
		const visible = () => grid.actions.filter((action) => !action.visible || action.visible(row()));
		const primary = () => visible().filter((action) => action.primary);
		const other = () => visible().filter((action) => !action.primary);
		const activate = (action, event, anchor) => {
			if (!action.confirm && !action.onClick) return;
			event.preventDefault();
			const button = event.currentTarget;
			const at = anchor ?? (button.closest("[role=menu]") ? button.closest(".phx-grid-actions")?.querySelector(".phx-grid-action-toggle") : null) ?? button;
			run(grid.runAction(action, row(), at).then(async (done) => {
				if (!done) return;
				if (action.href) await app?.router.navigate(action.href(row()));
				else await grid.load();
			}));
		};
		const item = (action, className) => action.href ? /* @__PURE__ */ jsx("a", {
			class: classes(className, action.danger && slot("danger")),
			href: action.href(row()),
			onClick: (event) => activate(action, event),
			children: action.label
		}) : /* @__PURE__ */ jsx("button", {
			type: "button",
			class: classes(className, action.danger && slot("danger")),
			onClick: (event) => activate(action, event),
			children: action.label
		});
		return /* @__PURE__ */ jsx("td", {
			class: classes(slot("td"), "phx-grid-td-actions"),
			children: /* @__PURE__ */ jsx("div", {
				class: "phx-grid-actions",
				children: [() => primary().map((action) => item(action, slot("actionPrimary"))), /* @__PURE__ */ jsx(If, {
					when: () => other().length > 0,
					children: /* @__PURE__ */ jsx(Popup, {
						class: slot("actionMenu"),
						label: texts.actions,
						button: (open, opened) => /* @__PURE__ */ jsx("button", {
							type: "button",
							class: slot("actionMenuToggle"),
							"aria-label": texts.actions,
							title: texts.actions,
							"aria-haspopup": "menu",
							"aria-expanded": () => String(opened()),
							ref: icon(ICONS.menu),
							onClick: open
						}),
						panel: (close) => /* @__PURE__ */ jsx("div", {
							role: "menu",
							onClick: () => close(),
							children: other().map((action) => item(action, slot("actionMenuItem")))
						})
					})
				})]
			})
		});
	};
	const cell = (column, row) => /* @__PURE__ */ jsx("td", {
		class: classes(slot("td"), `phx-grid-td-${column.key}`, column.alignment && `phx-grid-align-${column.alignment}`, column.cellClass),
		"data-col-key": column.key,
		children: () => {
			if (column.renderer) return column.renderer(row());
			const value = column.value(row());
			if (column.type === "bool") return value ? /* @__PURE__ */ jsx("span", {
				class: "phx-grid-bool",
				role: "img",
				"aria-label": texts.yes,
				children: "✓"
			}) : /* @__PURE__ */ jsx("span", {
				class: "phx-grid-bool phx-grid-bool-no",
				role: "img",
				"aria-label": texts.no,
				children: "–"
			});
			return column.text(value);
		}
	});
	const checkAll = (element) => {
		effect(() => {
			const keys = grid.rows().map((row) => grid.keyOf(row));
			const selected = keys.filter((key) => grid.selected().includes(key)).length;
			element.checked = keys.length > 0 && selected === keys.length;
			element.indeterminate = selected > 0 && selected < keys.length;
		});
	};
	const pagination = () => {
		const pages = () => {
			const page = grid.page();
			const from = Math.max(1, page - 2);
			const to = Math.min(grid.pages(), page + 2);
			return Array.from({ length: to - from + 1 }, (_, index) => from + index);
		};
		const pageButton = (target, text, label, disabled, active = () => false) => /* @__PURE__ */ jsx("li", {
			class: () => classes(slot("pageItem"), active() && slot("pageItemActive"), disabled() && slot("pageItemDisabled")),
			children: /* @__PURE__ */ jsx("button", {
				type: "button",
				class: slot("pageLink"),
				"aria-label": label,
				"aria-current": () => active() ? "page" : null,
				disabled,
				onClick: () => run(grid.goTo(target())),
				children: text
			})
		});
		return /* @__PURE__ */ jsx("div", {
			class: "phx-grid-footer",
			children: /* @__PURE__ */ jsx("nav", {
				class: slot("paginationNav"),
				"aria-label": texts.page.replace("%d", "").trim(),
				children: [/* @__PURE__ */ jsx("span", {
					class: slot("paginationInfo"),
					role: "status",
					children: () => {
						if (!grid.total()) return "";
						const first = (grid.page() - 1) * grid.pageSize() + 1;
						return format(texts.shown, first, Math.min(first + grid.pageSize() - 1, grid.total()), grid.total());
					}
				}), /* @__PURE__ */ jsx("div", {
					class: "phx-grid-pagination-right",
					children: [grid.options.pageSizes ? /* @__PURE__ */ jsx("label", {
						class: "phx-grid-per-page",
						children: [/* @__PURE__ */ jsx("span", {
							class: "phx-grid-per-page-label",
							children: texts.perPage
						}), /* @__PURE__ */ jsx("select", {
							class: classes(slot("filterSelect"), "phx-grid-per-page-select"),
							onChange: (event) => run(grid.setPageSize(Number(event.currentTarget.value))),
							children: grid.options.pageSizes.map((size) => /* @__PURE__ */ jsx("option", {
								value: String(size),
								selected: () => grid.pageSize() === size,
								children: String(size)
							}))
						})]
					}) : null, /* @__PURE__ */ jsx(If, {
						when: () => grid.pages() > 1,
						children: /* @__PURE__ */ jsx("ul", {
							class: slot("paginationList"),
							children: [
								pageButton(() => 1, "«", () => texts.first, () => grid.page() <= 1),
								pageButton(() => grid.page() - 1, "‹", () => texts.previous, () => grid.page() <= 1),
								/* @__PURE__ */ jsx(For, {
									each: pages,
									children: (page) => pageButton(() => page, String(page), () => format(texts.page, page), () => false, () => grid.page() === page)
								}),
								pageButton(() => grid.page() + 1, "›", () => texts.next, () => grid.page() >= grid.pages()),
								pageButton(() => grid.pages(), "»", () => texts.last, () => grid.page() >= grid.pages())
							]
						})
					})]
				})]
			})
		});
	};
	return /* @__PURE__ */ jsx("div", {
		class: classes("phx-grid-wrapper", props.class),
		"data-datagrid": true,
		children: [
			toolbar,
			bulkBar,
			/* @__PURE__ */ jsx("div", {
				class: slot("tableWrapper"),
				children: /* @__PURE__ */ jsx("table", {
					class: () => classes(slot("table"), fixed() && "phx-grid-table-fixed", grid.loading() && "phx-grid-loading"),
					style: () => fixed() ? `width:${tableWidth()}px` : null,
					"aria-label": props["aria-label"] ?? null,
					"aria-busy": () => grid.loading() ? "true" : null,
					ref: (element) => {
						table = element;
					},
					children: [
						/* @__PURE__ */ jsx("thead", {
							class: slot("thead"),
							children: [/* @__PURE__ */ jsx("tr", {
								ref: (element) => {
									headerRow = element;
								},
								children: [
									hasBulk ? /* @__PURE__ */ jsx("th", {
										class: classes(slot("th"), "phx-grid-th-check"),
										scope: "col",
										"data-width-key": "__check",
										style: () => fixed() ? `width:${widthOf("__check", null)}px` : null,
										children: /* @__PURE__ */ jsx("input", {
											type: "checkbox",
											class: classes(slot("check"), "phx-grid-check-all"),
											"aria-label": texts.selectAll,
											title: texts.selectAll,
											ref: checkAll,
											onChange: (event) => grid.togglePage(event.currentTarget.checked)
										})
									}) : null,
									/* @__PURE__ */ jsx(For, {
										each: grid.visibleColumns,
										children: (column) => header(column)
									}),
									hasActions ? /* @__PURE__ */ jsx("th", {
										class: classes(slot("th"), "phx-grid-th-actions"),
										scope: "col",
										"data-width-key": "__actions",
										style: () => fixed() ? `width:${widthOf("__actions", null)}px` : null,
										children: /* @__PURE__ */ jsx("span", {
											class: "phx-grid-visually-hidden",
											children: texts.actions
										})
									}) : null
								]
							}), /* @__PURE__ */ jsx(If, {
								when: hasFilters,
								children: /* @__PURE__ */ jsx("tr", {
									class: "phx-grid-filter-row",
									children: [
										hasBulk ? /* @__PURE__ */ jsx("th", { class: slot("thFilterCell") }) : null,
										/* @__PURE__ */ jsx(For, {
											each: grid.visibleColumns,
											children: (column) => /* @__PURE__ */ jsx("th", {
												class: classes(slot("thFilterCell"), "phx-grid-filter-th"),
												"data-col-key": column.key,
												children: column.filterKind ? /* @__PURE__ */ jsx("div", {
													class: "phx-grid-filter-cell-wrap",
													children: [filterControl(column), clearButton(column)]
												}) : null
											})
										}),
										hasActions ? /* @__PURE__ */ jsx("th", { class: slot("thFilterCell") }) : null
									]
								})
							})]
						}),
						/* @__PURE__ */ jsx("tbody", { children: /* @__PURE__ */ jsx(If, {
							when: () => grid.rows().length > 0,
							children: [
								/* @__PURE__ */ jsx(For, {
									each: grid.rows,
									children: (row) => /* @__PURE__ */ jsx("tr", {
										class: () => classes(hasBulk && grid.isSelected(row()) && slot("rowSelected")),
										children: [
											hasBulk ? /* @__PURE__ */ jsx("td", {
												class: classes(slot("td"), "phx-grid-td-check"),
												children: /* @__PURE__ */ jsx("input", {
													type: "checkbox",
													class: classes(slot("check"), "phx-grid-row-check"),
													"aria-label": texts.selectRow,
													checked: () => grid.isSelected(row()),
													onChange: (event) => grid.toggleRow(row(), event.currentTarget.checked)
												})
											}) : null,
											/* @__PURE__ */ jsx(For, {
												each: grid.visibleColumns,
												children: (column) => cell(column, row)
											}),
											hasActions ? actionsCell(row) : null
										]
									})
								}, (row) => grid.keyOf(row)),
								/* @__PURE__ */ jsx(Else, {}),
								/* @__PURE__ */ jsx("tr", {
									class: "phx-grid-empty-row",
									children: /* @__PURE__ */ jsx("td", {
										colSpan: span,
										class: slot("noData"),
										children: () => grid.loading() ? texts.loading : texts.noData
									})
								})
							]
						}) }),
						hasFooter ? /* @__PURE__ */ jsx("tfoot", { children: /* @__PURE__ */ jsx("tr", {
							class: "phx-grid-footer-row",
							children: [
								hasBulk ? /* @__PURE__ */ jsx("td", { class: classes(slot("td"), "phx-grid-td-check phx-grid-td-footer") }) : null,
								/* @__PURE__ */ jsx(For, {
									each: grid.visibleColumns,
									children: (column) => /* @__PURE__ */ jsx("td", {
										class: classes(slot("td"), "phx-grid-td-footer", column.alignment && `phx-grid-align-${column.alignment}`),
										"data-col-key": column.key,
										children: () => {
											const value = column.aggregateFn ? grid.aggregates()[column.key]?.[column.aggregateFn] : void 0;
											if (value === void 0) return null;
											return [/* @__PURE__ */ jsx("small", {
												class: "phx-grid-footer-label",
												children: texts[column.aggregateFn]
											}), /* @__PURE__ */ jsx("strong", { children: column.aggregateFn === "count" ? String(value) : column.text(value) })];
										}
									})
								}),
								hasActions ? /* @__PURE__ */ jsx("td", { class: classes(slot("td"), "phx-grid-td-footer") }) : null
							]
						}) }) : null
					]
				})
			}),
			pagination()
		]
	});
}
export { GridView };
