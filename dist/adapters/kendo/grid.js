import { Scope, effect, untrack } from "../../reactive/reactive.js";
import { insert } from "../../ui/dom.js";
import { Component } from "../../ui/component.js";
import { Kendo } from "./kendo.js";
import { jsx } from "../../jsx-runtime.js";
// src/adapters/kendo/grid.tsx
/**
* <KendoGrid>: Kendo Grid with its rows from state, and cells that can be templates of the framework
* (links, components) instead of HTML strings of Kendo.
*/
/** The index of the row in `data`, kept in the copies Kendo makes, to give back the original objects. */
var INDEX = "__phloxRow";
var KendoGrid = class extends Component {
	kendo;
	static $inject = () => [Kendo];
	grid = null;
	host;
	/** Scopes of cells made by `render`, cleaned up before every new drawing of the rows. */
	cells = [];
	constructor(kendo) {
		super();
		this.kendo = kendo;
	}
	render() {
		return /* @__PURE__ */ jsx("div", {
			class: ["phlox-kendo-grid", this.props.class].filter(Boolean).join(" "),
			ref: (element) => {
				this.host = element;
			}
		});
	}
	afterRender() {
		const { columns, data, options = {} } = this.props;
		const element = document.createElement("div");
		this.host.append(element);
		const rowsOf = (items) => items.map((item, index) => ({
			...item,
			[INDEX]: index
		}));
		const grid = this.grid = this.kendo.create("Grid", element, {
			...options,
			...data ? { dataSource: {
				...options.dataSource,
				data: rowsOf(untrack(data))
			} } : {},
			columns: columns.map((column, index) => {
				if (!column.render) return column;
				const { render: _render, ...rest } = column;
				return {
					...rest,
					template: () => `<span data-phlox-cell="${index}"></span>`
				};
			}),
			dataBound: (event) => {
				this.renderCells(this.grid);
				options.dataBound?.(event);
			}
		});
		this.scope.onCleanup(() => {
			this.clearCells();
			grid.destroy();
			this.host.replaceChildren();
		});
		this.renderCells(grid);
		if (data) this.scope.run(() => effect(() => void grid.dataSource.data(rowsOf(data()))));
		if (this.props.onSelect) grid.bind("change", () => {
			const row = grid.select()[0];
			this.props.onSelect(row ? this.original(grid.dataItem(row)) : null);
		});
		this.props.onCreate?.(grid);
	}
	/** The object from `data` behind a row of Kendo. */
	original(item) {
		const index = item?.[INDEX];
		return typeof index === "number" ? untrack(this.props.data)[index] ?? null : null;
	}
	renderCells(grid) {
		if (!grid || !this.props.columns.some((column) => column.render)) return;
		this.clearCells();
		for (const cell of this.host.querySelectorAll("[data-phlox-cell]")) {
			const row = this.original(grid.dataItem(cell.closest("tr")));
			const column = this.props.columns[Number(cell.dataset.phloxCell)];
			if (!row || !column?.render) continue;
			const scope = new Scope(this.scope);
			this.cells.push(scope);
			scope.run(() => insert(cell, untrack(() => column.render(row)), null));
		}
	}
	clearCells() {
		for (const scope of this.cells.splice(0)) scope.dispose();
	}
};
export { KendoGrid };
