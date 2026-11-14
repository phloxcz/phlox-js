import { batch, computed, effect, state, untrack } from "../reactive/reactive.js";
import { toPairs } from "../forms/controls.js";
import { foldText } from "../forms/listbox.js";
import { texts } from "../ui/texts.js";
// src/components/grid.ts
/**
* The data grid, like phloxcz/components-grid: columns, sorting, search, filters, pages, actions on rows,
* actions on selected rows and totals. This is the model, <GridView> draws it.
*
* Data come from `load` with a query in the format of phloxcz/api-query (the format of Kendo UI),
* or from `rows` in the browser, which are searched, filtered, sorted and paged here the same way.
*/
var RANGE = "..";
/** A column; the methods set it up and return it, like the rules of a form control. */
var GridColumn = class {
	key;
	label;
	type;
	canSort = false;
	canSearch = false;
	canHide = true;
	filterKind = null;
	filterItems = [];
	dropDown = null;
	initialWidth = null;
	alignment;
	aggregateFn = null;
	cellClass = "";
	renderer = null;
	formatter = null;
	constructor(key, label, type) {
		this.key = key;
		this.label = label;
		this.type = type;
		this.alignment = type === "number" ? "end" : type === "bool" ? "center" : null;
	}
	sortable(on = true) {
		this.canSort = on;
		return this;
	}
	/** Searched by the search field of the grid, with `rows`. On the server the API decides what is searched. */
	searchable(on = true) {
		this.canSearch = on;
		return this;
	}
	/** A filter fitting the column: text, a range for numbers and dates, yes and no for a bool. */
	filterable(kind = this.type === "number" || this.type === "date" ? "range" : this.type === "bool" ? "bool" : "text") {
		this.filterKind = kind;
		return this;
	}
	/** A filter with fixed choices. */
	filterSelect(items, multiple = false) {
		this.filterKind = multiple ? "multiSelect" : "select";
		this.filterItems = toPairs(items);
		return this;
	}
	/** A filter with choices from the server, a DropDownList with search. `label` gives the label of a value from the URL. */
	filterDropDown(options) {
		this.filterKind = "dropDown";
		this.dropDown = options;
		return this;
	}
	/** The starting width, e.g. '12rem'. The user can change it when the grid allows it. */
	width(width) {
		this.initialWidth = width;
		return this;
	}
	align(alignment) {
		this.alignment = alignment;
		return this;
	}
	/** The column cannot be hidden. */
	alwaysVisible() {
		this.canHide = false;
		return this;
	}
	/** A total in the footer. */
	aggregate(fn) {
		this.aggregateFn = fn;
		return this;
	}
	/** The text of a value: a number with its unit, a date in a format... */
	format(fn) {
		this.formatter = fn;
		return this;
	}
	/** The content of a cell, any template: a link, a badge... */
	render(fn) {
		this.renderer = fn;
		return this;
	}
	class(className) {
		this.cellClass = className;
		return this;
	}
	/** The value of the column in a row. */
	value(row) {
		return row[this.key];
	}
	/** A value as text, for a cell and for the footer. */
	text(value) {
		if (this.formatter) return this.formatter(value);
		if (value === null || value === void 0 || value === "") return "";
		if (this.type === "number" && typeof value === "number") return value.toLocaleString();
		if (this.type === "date") {
			const date = new Date(String(value));
			return Number.isNaN(date.getTime()) ? String(value) : /T\d/.test(String(value)) ? date.toLocaleString() : date.toLocaleDateString();
		}
		return String(value);
	}
	/** A value from the URL as the type of the column: a number for a number, true or false for a bool. */
	typed(text) {
		const item = this.filterItems.find(([value]) => String(value) === text);
		if (item) return item[0];
		if (this.type === "number") return Number(text);
		if (this.type === "bool") return text === "1" || text === "true";
		return text;
	}
	/** Conditions of the query for a filter as the user set it. */
	conditions(value) {
		const field = this.key;
		if (Array.isArray(value)) return value.length ? [{
			field,
			operator: "in",
			value: value.map((text) => this.typed(text))
		}] : [];
		if (value === "") return [];
		switch (this.filterKind) {
			case "text": return [{
				field,
				operator: "contains",
				value
			}];
			case "range": {
				const [from = "", to = ""] = value.split(RANGE);
				return [...from ? [{
					field,
					operator: "gte",
					value: this.typed(from)
				}] : [], ...to ? [{
					field,
					operator: "lte",
					value: this.typed(to)
				}] : []];
			}
			default: return [{
				field,
				operator: "eq",
				value: this.typed(value)
			}];
		}
	}
};
/** Searches, filters, sorts, counts and pages rows in the browser, by the same query as the server gets. */
function applyQuery(rows, query, searchIn = []) {
	const get = (row, field) => row[field];
	const words = foldText(query.search ?? "").split(/\s+/).filter(Boolean);
	const compare = (a, b) => {
		if (a === b) return 0;
		if (a === null || a === void 0) return -1;
		if (b === null || b === void 0) return 1;
		if (typeof a === "number" && typeof b === "number") return a - b;
		if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
		return String(a).localeCompare(String(b));
	};
	const matches = (row, condition) => {
		const value = get(row, condition.field);
		switch (condition.operator) {
			case "contains": return foldText(String(value ?? "")).includes(foldText(String(condition.value)));
			case "in": return condition.value.some((item) => compare(item, value) === 0);
			case "gte": return value !== null && value !== void 0 && compare(value, condition.value) >= 0;
			case "lte": return value !== null && value !== void 0 && compare(typeof value === "string" && typeof condition.value === "string" ? value.slice(0, condition.value.length) : value, condition.value) <= 0;
			default: return compare(value, condition.value) === 0;
		}
	};
	let found = rows.filter((row) => words.every((word) => searchIn.some((field) => foldText(String(get(row, field) ?? "")).includes(word))) && (query.filter?.filters ?? []).every((condition) => matches(row, condition)));
	for (const { field, dir } of [...query.sort].reverse()) found = [...found].sort((a, b) => compare(get(a, field), get(b, field)) * (dir === "desc" ? -1 : 1));
	const aggregates = {};
	for (const { field, aggregate } of query.aggregate ?? []) {
		const values = found.map((row) => get(row, field)).filter((value) => typeof value === "number");
		const sum = values.reduce((total, value) => total + value, 0);
		const result = {
			sum,
			count: found.length,
			avg: values.length ? sum / values.length : 0,
			min: values.length ? Math.min(...values) : 0,
			max: values.length ? Math.max(...values) : 0
		}[aggregate];
		(aggregates[field] ??= {})[aggregate] = result;
	}
	const start = (query.page - 1) * query.pageSize;
	return {
		data: found.slice(start, start + query.pageSize),
		total: found.length,
		aggregates
	};
}
var Grid = class Grid {
	options;
	static texts = texts("grid", {
		search: "Search…",
		reset: "Reset",
		filter: "Filter",
		all: "All",
		yes: "Yes",
		no: "No",
		apply: "Apply",
		from: "From",
		to: "To",
		clearFilter: "Clear the filter",
		noData: "No records",
		loading: "Loading…",
		shown: "%d–%d of %d",
		perPage: "Rows on a page",
		first: "First page",
		previous: "Previous page",
		next: "Next page",
		last: "Last page",
		page: "Page %d",
		columns: "Columns",
		moveLeft: "Move left",
		moveRight: "Move right",
		selected: "Selected: %d",
		selectAll: "Select all on the page",
		selectRow: "Select the row",
		actions: "Actions",
		sortBy: "Sort by %s",
		resize: "Change the width of %s",
		sum: "Total",
		avg: "Average",
		count: "Count",
		min: "Minimum",
		max: "Maximum"
	});
	/**
	* Asks before an action with `confirm`. Null asks by the application: a popover at the button of the action
	* (see Application.confirm), or window.confirm() outside an application. An own question: Grid.confirm = (question, anchor) => ...
	*/
	static confirm = null;
	/** How <GridView> asks when Grid.confirm is null; set by the view to the confirm() of the application. */
	ask = (question) => window.confirm(question);
	columns = [];
	actions = [];
	bulkActions = [];
	page = state(1);
	pageSize;
	sort = state(null);
	search = state("");
	filters = state({});
	rows = state([]);
	total = state(0);
	aggregates = state({});
	loading = state(false);
	selected = state([]);
	widths = state({});
	order = state([]);
	hidden = state([]);
	/** Columns in the order and visibility the user chose. */
	visibleColumns = computed(() => {
		const order = this.order();
		const position = (column) => order.includes(column.key) ? order.indexOf(column.key) : order.length + this.columns.indexOf(column);
		return [...this.columns].sort((a, b) => position(a) - position(b)).filter((column) => !this.hidden().includes(column.key));
	});
	pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
	loads = 0;
	bound = null;
	loaded = false;
	constructor(options = {}) {
		this.options = options;
		this.pageSize = state(options.pageSize ?? 20);
		this.restoreLayout();
	}
	addColumn(key, label, render) {
		const column = new GridColumn(key, label, render ? "custom" : "text");
		if (render) column.render(render);
		this.columns.push(column);
		return column;
	}
	addTextColumn(key, label) {
		return this.push(new GridColumn(key, label, "text"));
	}
	addNumberColumn(key, label) {
		return this.push(new GridColumn(key, label, "number"));
	}
	/** A date as text YYYY-MM-DD or a date and time in ISO 8601, as an API sends them. */
	addDateColumn(key, label) {
		return this.push(new GridColumn(key, label, "date"));
	}
	addBoolColumn(key, label) {
		return this.push(new GridColumn(key, label, "bool"));
	}
	/** An action on a row: a link (`href`) or a function (`onClick`). Primary ones are buttons, the others are in a menu. */
	addAction(label, action) {
		this.actions.push({
			label,
			...action
		});
		return this;
	}
	/** An action on the selected rows. Rows get checkboxes, the selection is kept across pages. */
	addBulkAction(label, run, options = {}) {
		this.bulkActions.push({
			label,
			run,
			...options
		});
		return this;
	}
	column(key) {
		return this.columns.find((column) => column.key === key);
	}
	keyOf(row) {
		return row[this.options.key ?? "id"];
	}
	/** The query for the current state. */
	query() {
		const sort = this.sort();
		const conditions = Object.entries(this.filters()).flatMap(([key, value]) => this.column(key)?.conditions(value) ?? []);
		const aggregate = this.columns.filter((column) => column.aggregateFn).map((column) => ({
			field: column.key,
			aggregate: column.aggregateFn
		}));
		return {
			page: this.page(),
			pageSize: this.pageSize(),
			sort: sort ? [sort] : [],
			...this.search() ? { search: this.search() } : {},
			...conditions.length ? { filter: {
				logic: "and",
				filters: conditions
			} } : {},
			...aggregate.length ? { aggregate } : {}
		};
	}
	/** Loads the rows for the current state. An older answer never overwrites a newer one. */
	async load() {
		this.loaded = true;
		const query = untrack(() => this.query());
		const ticket = ++this.loads;
		this.loading.set(true);
		try {
			const result = this.options.load ? await this.options.load(query) : applyQuery(untrack(() => this.localRows()), query, this.columns.filter((column) => column.canSearch).map((column) => column.key));
			if (ticket !== this.loads) return;
			const last = Math.max(1, Math.ceil(result.total / query.pageSize));
			if (query.page > last && result.total > 0) return this.change({ page: last });
			batch(() => {
				this.rows.set(result.data);
				this.total.set(result.total);
				this.aggregates.set(result.aggregates ?? {});
			});
		} finally {
			if (ticket === this.loads) this.loading.set(false);
		}
	}
	/** Loads once, for the first drawing. */
	loadOnce() {
		return this.loaded ? Promise.resolve() : this.load();
	}
	sortBy(key) {
		const sort = untrack(this.sort);
		const next = sort?.field !== key ? {
			field: key,
			dir: "asc"
		} : sort.dir === "asc" ? {
			field: key,
			dir: "desc"
		} : null;
		return this.change({
			sort: next,
			page: 1
		});
	}
	goTo(page) {
		return this.change({ page: Math.min(Math.max(1, page), untrack(this.pages)) });
	}
	setPageSize(size) {
		return this.change({
			pageSize: size,
			page: 1
		});
	}
	setSearch(text) {
		return this.change({
			search: text.trim(),
			page: 1
		});
	}
	/** Sets the filter of a column; an empty value removes it. */
	setFilter(key, value) {
		const filters = { ...untrack(this.filters) };
		if (value === null || value === "" || Array.isArray(value) && !value.length || value === RANGE) delete filters[key];
		else filters[key] = value;
		return this.change({
			filters,
			page: 1
		});
	}
	/** Clears the search and all filters. */
	reset() {
		return this.change({
			search: "",
			filters: {},
			page: 1
		});
	}
	change(patch) {
		if (this.bound) {
			const { presenter } = this.bound;
			const current = untrack(() => ({
				page: this.page(),
				pageSize: this.pageSize(),
				sort: this.sort(),
				search: this.search(),
				filters: this.filters()
			}));
			return presenter.app.router.navigate(presenter.link("this", this.toParams({
				...current,
				...patch
			})));
		}
		batch(() => {
			if (patch.page !== void 0) this.page.set(patch.page);
			if (patch.pageSize !== void 0) this.pageSize.set(patch.pageSize);
			if (patch.sort !== void 0) this.sort.set(patch.sort);
			if (patch.search !== void 0) this.search.set(patch.search);
			if (patch.filters !== void 0) this.filters.set(patch.filters);
		});
		return this.load();
	}
	/**
	* Keeps the state in the URL of the presenter: ?page=2&sort=-name&q=text&f.state=open. Back and Forward
	* return it, a link shows the same. The parameters become persistent, so links of the presenter keep them.
	* Two grids on one page need a prefix: bind(this, 'orders-').
	*/
	bind(presenter, prefix = "") {
		this.bound = {
			presenter,
			prefix
		};
		presenter.persistent.push(`${prefix}page`, `${prefix}size`, `${prefix}sort`, `${prefix}q`, `${prefix}f.*`);
		return this;
	}
	/**
	* Follows the URL of the bound presenter: called while drawing (by <GridView>), it reloads
	* whenever the parameters change.
	*/
	follow() {
		if (!this.bound) return;
		const { presenter } = this.bound;
		let last = "";
		effect(() => {
			const params = presenter.params();
			untrack(() => {
				this.fromParams(params);
				const key = JSON.stringify(this.query());
				if (key === last && this.loaded) return;
				last = key;
				this.load();
			});
		});
	}
	toParams(state) {
		const p = this.bound?.prefix ?? "";
		const params = {
			[`${p}page`]: state.page > 1 ? state.page : null,
			[`${p}size`]: state.pageSize !== (this.options.pageSize ?? 20) ? state.pageSize : null,
			[`${p}sort`]: state.sort ? `${state.sort.dir === "desc" ? "-" : ""}${state.sort.field}` : null,
			[`${p}q`]: state.search || null
		};
		for (const column of this.columns) params[`${p}f.${column.key}`] = null;
		for (const [key, value] of Object.entries(state.filters)) params[`${p}f.${key}`] = Array.isArray(value) ? value.join(",") : value;
		return params;
	}
	fromParams(params) {
		const p = this.bound?.prefix ?? "";
		const sort = params[`${p}sort`] ?? "";
		const filters = {};
		for (const column of this.columns) {
			const value = params[`${p}f.${column.key}`];
			if (value) filters[column.key] = column.filterKind === "multiSelect" ? value.split(",") : value;
		}
		batch(() => {
			this.page.set(Math.max(1, Number(params[`${p}page`]) || 1));
			this.pageSize.set(Number(params[`${p}size`]) || (this.options.pageSize ?? 20));
			this.sort.set(sort ? {
				field: sort.replace(/^-/, ""),
				dir: sort.startsWith("-") ? "desc" : "asc"
			} : null);
			this.search.set(params[`${p}q`] ?? "");
			this.filters.set(filters);
		});
	}
	isSelected(row) {
		return this.selected().includes(this.keyOf(row));
	}
	toggleRow(row, on = !untrack(() => this.isSelected(row))) {
		const key = this.keyOf(row);
		this.selected.update((keys) => on ? [...keys.filter((other) => other !== key), key] : keys.filter((other) => other !== key));
	}
	/** Selects or unselects all rows on the page. */
	togglePage(on) {
		const keys = untrack(this.rows).map((row) => this.keyOf(row));
		this.selected.update((selected) => on ? [...selected.filter((key) => !keys.includes(key)), ...keys] : selected.filter((key) => !keys.includes(key)));
	}
	/** Runs an action on the selected rows, after a confirmation, then clears the selection and loads again. */
	async runBulk(action, anchor) {
		const keys = untrack(this.selected);
		if (!keys.length || action.confirm && !await this.question(action.confirm, anchor, action.danger)) return;
		const rows = untrack(this.rows).filter((row) => keys.includes(this.keyOf(row)));
		await action.run(keys, rows);
		this.selected.set([]);
		await this.load();
	}
	/** Runs an action on a row, after a confirmation. */
	async runAction(action, row, anchor) {
		const question = typeof action.confirm === "function" ? action.confirm(row) : action.confirm;
		if (question && !await this.question(question, anchor, action.danger)) return false;
		await action.onClick?.(row);
		return true;
	}
	question(text, anchor, danger) {
		return (Grid.confirm ?? this.ask)(text, anchor, danger);
	}
	setWidth(key, width) {
		this.widths.update((widths) => ({
			...widths,
			[key]: width
		}));
		this.saveLayout();
	}
	/** Moves a column before another one, or to the end with null. */
	moveColumn(key, before) {
		const keys = untrack(this.visibleColumns).map((column) => column.key);
		const all = [...keys, ...this.columns.map((column) => column.key).filter((other) => !keys.includes(other))].filter((other) => other !== key);
		all.splice(before === null ? keys.length - 1 : all.indexOf(before), 0, key);
		this.order.set(all);
		this.saveLayout();
	}
	/** Moves a column by one place, for the keyboard. */
	shiftColumn(key, by) {
		const keys = untrack(this.visibleColumns).map((column) => column.key);
		const at = keys.indexOf(key) + by;
		if (at < 0 || at >= keys.length) return;
		this.moveColumn(key, by < 0 ? keys[at] : keys[at + 1] ?? null);
	}
	toggleColumn(key, show) {
		this.hidden.update((hidden) => show ? hidden.filter((other) => other !== key) : [...hidden.filter((other) => other !== key), key]);
		this.saveLayout();
	}
	/** Forgets the remembered columns. */
	resetColumns() {
		batch(() => {
			this.widths.set({});
			this.order.set([]);
			this.hidden.set([]);
		});
		this.saveLayout();
	}
	localRows() {
		const rows = this.options.rows ?? [];
		return typeof rows === "function" ? rows() : rows;
	}
	push(column) {
		this.columns.push(column);
		return column;
	}
	layoutKey() {
		return this.options.remember ? `phlox-grid:${this.options.remember}` : null;
	}
	restoreLayout() {
		const key = this.layoutKey();
		if (!key) return;
		try {
			const layout = JSON.parse(localStorage.getItem(key) ?? "null");
			if (!layout) return;
			this.widths.set(layout.widths ?? {});
			this.order.set(layout.order ?? []);
			this.hidden.set(layout.hidden ?? []);
		} catch {}
	}
	saveLayout() {
		const key = this.layoutKey();
		if (!key) return;
		const layout = untrack(() => ({
			widths: this.widths(),
			order: this.order(),
			hidden: this.hidden()
		}));
		try {
			localStorage.setItem(key, JSON.stringify(layout));
		} catch {}
	}
};
export { Grid, GridColumn, applyQuery };
