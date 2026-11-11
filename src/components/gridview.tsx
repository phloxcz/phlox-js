/**
 * Drawing of a Grid with the HTML and classes of phloxcz/components-grid: a toolbar with search and columns,
 * a bar for selected rows, the table with sorting, filters, actions and totals, and pages below it.
 */

import { For, If, Else } from '../ui/flow';
import { effect, getScope, onCleanup, state, untrack } from '../reactive/reactive';
import type { Child } from '../ui/dom';
import { APP } from '../ui/component';
import { classes, currentTheme } from '../ui/theme';
import { followPointer } from '../ui/drag';
import type { Application } from '../application/application';
import { Form } from '../forms/form';
import { DropDownList } from '../forms/dropdownlist';
import { Grid } from './grid';
import type { GridAction, GridColumn } from './grid';

const ICONS = {
  asc: '<svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M8 4l5 7H3z"/></svg>',
  desc: '<svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M8 12L3 5h10z"/></svg>',
  none: '<svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" aria-hidden="true" opacity=".4"><path d="M8 2l4 5H4zM8 14l-4-5h8z"/></svg>',
  clear: '<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>',
  menu: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg>',
};

/** Puts a fixed SVG into an element, the renderer makes no SVG. */
const icon = (svg: string) => (element: HTMLElement) => { element.innerHTML = svg; };

/** The pointer must move this far before a press on a header becomes moving the column. */
const DRAG_THRESHOLD = 5;
/** How long typing waits before it searches or filters. */
const TYPING_DELAY = 400;

export interface GridViewProps<R extends object> {
  grid: Grid<R>;
  /** The search field above the table. */
  search?: boolean;
  /** Columns can be made wider or narrower by dragging the edge of a header. */
  resizable?: boolean;
  /** Columns can be moved by dragging a header. */
  reorderable?: boolean;
  /** A menu to hide, show and move columns. */
  columnToggle?: boolean;
  'aria-label'?: string;
  class?: string;
}

const format = (text: string, ...values: (string | number)[]) => {
  let next = 0;
  return text.replace(/%[ds]/g, () => String(values[next++] ?? ''));
};

/**
 * A panel under a button (a filter, a menu): placed `fixed`, so a table that scrolls does not cut it,
 * moved left when it would leave the window, above the button when there is no room below.
 */
function placePopup(anchor: HTMLElement, panel: HTMLElement): void {
  const update = () => {
    const box = anchor.getBoundingClientRect();
    Object.assign(panel.style, { display: 'block', position: 'fixed', margin: '0', zIndex: '1070', right: 'auto', bottom: 'auto' });
    const left = Math.max(8, Math.min(box.left, window.innerWidth - panel.offsetWidth - 8));
    const below = window.innerHeight - box.bottom;
    const top = below < panel.offsetHeight + 4 && box.top > below ? box.top - panel.offsetHeight - 2 : box.bottom + 2;
    Object.assign(panel.style, { left: `${left}px`, top: `${top}px` });
  };
  update();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(update);
  window.addEventListener('scroll', update, true);
  window.addEventListener('resize', update);
  onCleanup(() => {
    window.removeEventListener('scroll', update, true);
    window.removeEventListener('resize', update);
  });
}

/** A button with a panel that closes by Escape, by a click outside or when the focus leaves it. */
function Popup(props: {
  button: (open: () => void, opened: () => boolean) => Child;
  panel: (close: () => void) => Child;
  class: string;
  label?: string;
}): Child {
  const opened = state(false);
  let wrapper: HTMLElement;
  const close = (): void => {
    opened.set(false);
    wrapper.querySelector<HTMLElement>(':scope > button')?.focus();
  };
  const outside = (event: PointerEvent): void => {
    if (!wrapper.contains(event.target as Node)) opened.set(false);
  };
  effect(() => {
    if (!opened()) return;
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  });
  return (
    <div
      class="phx-grid-ms-wrap"
      ref={element => { wrapper = element; }}
      onFocusout={event => {
        if (!wrapper.contains(event.relatedTarget as Node | null) && event.relatedTarget) opened.set(false);
      }}
      onKeydown={event => {
        if (event.key !== 'Escape' || !untrack(opened)) return;
        // Only the panel closes, not a dialog around it
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
    >
      {props.button(() => opened.update(open => !open), opened)}
      <If when={opened}>
        <div
          class={props.class}
          role="dialog"
          aria-label={props.label ?? null}
          ref={panel => {
            placePopup(wrapper.querySelector<HTMLElement>(':scope > button')!, panel);
            queueMicrotask(() => panel.querySelector<HTMLElement>('input, select, button, a')?.focus());
          }}
        >
          {props.panel(close)}
        </div>
      </If>
    </div>
  );
}

export function GridView<R extends object>(props: GridViewProps<R>): Child {
  const { grid } = props;
  const theme = currentTheme();
  const slot = (part: string) => theme.class(`grid.${part}`);
  const texts = Grid.texts;
  const app = getScope()?.find<Application>(APP);
  const fail = (error: unknown) => (app ? app.onError(error) : console.error(error));
  const run = (work: Promise<unknown>) => void work.catch(fail);
  // Controls of filters that are form controls (a DropDownList), in a form of their own
  const filterForm = new Form();

  grid.follow();
  if (!untrack(() => grid.loading())) run(grid.loadOnce());

  const hasFilters = () => grid.visibleColumns().some(column => column.filterKind);
  const hasBulk = grid.bulkActions.length > 0;
  const hasActions = grid.actions.length > 0;
  const hasFooter = grid.columns.some(column => column.aggregateFn);
  const span = () => grid.visibleColumns().length + (hasBulk ? 1 : 0) + (hasActions ? 1 : 0);
  const filtered = () => grid.search() !== '' || Object.keys(grid.filters()).length > 0;

  // Typing waits a moment, so every letter is not a new query
  const typing = (apply: (text: string) => Promise<void>) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    onCleanup(() => clearTimeout(timer));
    return {
      onInput: (event: Event) => {
        clearTimeout(timer);
        const text = (event.currentTarget as HTMLInputElement).value;
        timer = setTimeout(() => run(apply(text)), TYPING_DELAY);
      },
      onKeydown: (event: KeyboardEvent) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        clearTimeout(timer);
        run(apply((event.currentTarget as HTMLInputElement).value));
      },
    };
  };

  // The search, columns and reset above the table

  const toolbar = (
    <div class="phx-grid-header">
      <div class={classes(slot('toolbar'), 'phx-grid-toolbar-gap')}>
        {props.search ? (
          <div class={classes(slot('searchGroup'), 'phx-grid-search-group')}>
            <input
              type="search"
              class={classes(slot('searchInput'), 'phx-grid-search-input')}
              placeholder={texts.search}
              aria-label={texts.search}
              autocomplete="off"
              value={grid.search}
              {...typing(text => grid.setSearch(text))}
            />
          </div>
        ) : null}
        <If when={filtered}>
          <button type="button" class={slot('resetBtn')} onClick={() => run(grid.reset())}>
            <span ref={icon(ICONS.clear)} /> {texts.reset}
          </button>
        </If>
        {props.columnToggle ? columnToggle() : null}
      </div>
    </div>
  );

  function columnToggle(): Child {
    return (
      <div class="phx-grid-coltoggle-wrap">
        <Popup
          class={classes(slot('colToggleDropdown'), 'phx-grid-coltoggle-menu')}
          label={texts.columns}
          button={(open, opened) => (
            <button type="button" class={slot('colToggleBtn')} aria-haspopup="dialog" aria-expanded={() => String(opened())} onClick={open}>
              {texts.columns}
            </button>
          )}
          panel={() => (
            <For each={() => [...grid.visibleColumns(), ...grid.columns.filter(column => !grid.visibleColumns().includes(column))]}>
              {column => (
                <div class={classes(slot('colToggleItem'), 'phx-grid-coltoggle-item')}>
                  <label class="phx-grid-coltoggle-label">
                    <input
                      type="checkbox"
                      class={classes(slot('colToggleCheck'), 'phx-grid-coltoggle-check')}
                      checked={() => !grid.hidden().includes(column.key)}
                      disabled={!column.canHide}
                      onChange={event => grid.toggleColumn(column.key, event.currentTarget.checked)}
                    />
                    <span>{column.label}</span>
                  </label>
                  {/* Moving by the keyboard, dragging a header is only for the mouse */}
                  <button type="button" class="phx-grid-coltoggle-move" aria-label={`${texts.moveLeft}: ${column.label}`} title={texts.moveLeft}
                    onClick={() => grid.shiftColumn(column.key, -1)}>←</button>
                  <button type="button" class="phx-grid-coltoggle-move" aria-label={`${texts.moveRight}: ${column.label}`} title={texts.moveRight}
                    onClick={() => grid.shiftColumn(column.key, 1)}>→</button>
                </div>
              )}
            </For>
          )}
        />
      </div>
    );
  }

  // Selected rows

  const bulkBar = hasBulk ? (
    <If when={() => grid.selected().length > 0}>
      <div class={classes('phx-grid-bulk-bar', slot('bulkBar'))} role="region" aria-label={texts.actions}>
        <span class={classes(slot('bulkCount'), 'phx-grid-bulk-bar-count')}>{() => format(texts.selected, grid.selected().length)}</span>
        {grid.bulkActions.map(action => (
          <button type="button" class={classes(slot('bulkBtn'), action.danger && slot('danger'))} onClick={() => run(grid.runBulk(action))}>
            {action.label}
          </button>
        ))}
      </div>
    </If>
  ) : null;

  // Filters

  const clearButton = (column: GridColumn<R>) => (
    <button
      type="button"
      class={classes(slot('filterClear'), 'phx-grid-filter-clear')}
      title={texts.clearFilter}
      aria-label={`${texts.clearFilter}: ${column.label}`}
      tabIndex={-1}
      disabled={() => grid.filters()[column.key] === undefined}
      ref={icon(ICONS.clear)}
      onClick={() => run(grid.setFilter(column.key, null))}
    />
  );

  const valueOf = (column: GridColumn<R>) => () => {
    const value = grid.filters()[column.key];
    return typeof value === 'string' ? value : '';
  };

  function filterControl(column: GridColumn<R>): Child {
    const label = `${texts.filter}: ${column.label}`;
    switch (column.filterKind) {
      case 'text':
        return (
          <input type="text" class={slot('filterInput')} placeholder={texts.filter} aria-label={label} autocomplete="off"
            value={valueOf(column)} {...typing(text => grid.setFilter(column.key, text.trim()))} />
        );
      case 'select':
      case 'bool': {
        const items = column.filterKind === 'bool' ? [['1', texts.yes], ['0', texts.no]] : column.filterItems.map(([value, text]) => [String(value), text]);
        return (
          <select class={slot('filterSelect')} aria-label={label} onChange={event => run(grid.setFilter(column.key, event.currentTarget.value))}>
            <option value="" selected={() => valueOf(column)() === ''}>{texts.all}</option>
            {items.map(([value, text]) => <option value={value} selected={() => valueOf(column)() === value}>{text}</option>)}
          </select>
        );
      }
      case 'multiSelect':
        return multiSelect(column, label);
      case 'range':
        return range(column, label);
      case 'dropDown':
        return dropDown(column, label);
      default:
        return null;
    }
  }

  function multiSelect(column: GridColumn<R>, label: string): Child {
    const chosen = () => (grid.filters()[column.key] as string[] | undefined) ?? [];
    const draft = state<string[]>([]);
    return (
      <Popup
        class={classes(slot('msDropdown'), 'phx-grid-ms-dropdown')}
        label={label}
        button={(open, opened) => (
          <button type="button" class={slot('msTrigger')} aria-label={label} aria-haspopup="dialog" aria-expanded={() => String(opened())}
            onClick={() => { draft.set(untrack(chosen)); open(); }}>
            <span class="phx-grid-ms-label">
              {() => {
                const labels = column.filterItems.filter(([value]) => chosen().includes(String(value))).map(([, text]) => text);
                return labels.length ? [labels[0], labels.length > 1 ? <span class="phx-grid-ms-more"> +{labels.length - 1}</span> : null] : texts.all;
              }}
            </span>
          </button>
        )}
        panel={close => (
          <>
            {column.filterItems.map(([value, text]) => (
              <label class={classes(slot('msItem'), 'phx-grid-ms-item')}>
                <input type="checkbox" class={classes(slot('msCheck'), 'phx-grid-ms-check')}
                  checked={() => draft().includes(String(value))}
                  onChange={event => draft.update(list => (event.currentTarget.checked ? [...list, String(value)] : list.filter(other => other !== String(value))))} />
                <span>{text}</span>
              </label>
            ))}
            <div class="phx-grid-ms-footer">
              <button type="button" class={slot('msApply')} onClick={() => { close(); run(grid.setFilter(column.key, untrack(draft))); }}>{texts.apply}</button>
            </div>
          </>
        )}
      />
    );
  }

  function range(column: GridColumn<R>, label: string): Child {
    const parts = () => valueOf(column)().split('..');
    let from: HTMLInputElement;
    let to: HTMLInputElement;
    const type = column.type === 'date' ? 'date' : 'number';
    const apply = (close: () => void) => {
      close();
      run(grid.setFilter(column.key, from.value || to.value ? `${from.value}..${to.value}` : null));
    };
    return (
      <Popup
        class={classes(slot('msDropdown'), 'phx-grid-ms-dropdown')}
        label={label}
        button={(open, opened) => (
          <button type="button" class={slot('msTrigger')} aria-label={label} aria-haspopup="dialog" aria-expanded={() => String(opened())} onClick={open}>
            <span class="phx-grid-ms-label">
              {() => (valueOf(column)() ? `${column.text(parts()[0] ? column.typed(parts()[0]!) : '') || '…'} – ${column.text(parts()[1] ? column.typed(parts()[1]!) : '') || '…'}` : texts.filter)}
            </span>
          </button>
        )}
        panel={close => (
          <div onKeydown={event => { if (event.key === 'Enter') { event.preventDefault(); apply(close); } }}>
            <div class="phx-grid-range-wrap phx-grid-range-wrap--panel">
              <span class="phx-grid-range-label">{texts.from}</span>
              <input type={type} class={classes(slot('filterInput'), 'phx-grid-range-input')} aria-label={`${label}, ${texts.from}`}
                value={untrack(parts)[0] ?? ''} ref={element => { from = element; }} />
              <span class="phx-grid-range-label">{texts.to}</span>
              <input type={type} class={classes(slot('filterInput'), 'phx-grid-range-input')} aria-label={`${label}, ${texts.to}`}
                value={untrack(parts)[1] ?? ''} ref={element => { to = element; }} />
            </div>
            <div class="phx-grid-ms-footer">
              <button type="button" class={slot('msApply')} onClick={() => apply(close)}>{texts.apply}</button>
            </div>
          </div>
        )}
      />
    );
  }

  function dropDown(column: GridColumn<R>, label: string): Child {
    const control = filterForm.addControl(column.key, new DropDownList<unknown>(label, {
      search: column.dropDown!.search,
      ...(column.dropDown!.label ? { label: column.dropDown!.label } : {}),
      placeholder: texts.all,
    }));
    // The control follows the filter (also from the URL), the filter follows a pick in the control
    effect(() => {
      const value = valueOf(column)();
      untrack(() => {
        if (String(control.getValue() ?? '') !== value) control.setValue(value === '' ? null : column.typed(value));
      });
    });
    effect(() => {
      const value = control.value();
      untrack(() => {
        const text = value === null || value === undefined ? '' : String(value);
        if (text !== valueOf(column)()) run(grid.setFilter(column.key, text || null));
      });
    });
    return <div class="phx-grid-ddl" aria-label={label}>{control.render({})}</div>;
  }

  // Headers: sorting, the width and the order of columns

  let table: HTMLTableElement;
  let headerRow: HTMLTableRowElement;

  // Widths: once the user changes one, all columns get a width of their own (table-layout: fixed)
  const fixed = () => Object.keys(grid.widths()).length > 0;
  /** A width in px: the remembered one, the one set in the code, or a default for a column added later. */
  const widthOf = (key: string, initial: string | null): number => {
    const width = grid.widths()[key] ?? initial ?? '';
    const size = Number.parseFloat(width);
    if (Number.isNaN(size)) return key === '__check' ? 36 : 150;
    return /r?em$/.test(width) ? size * 16 : size;
  };
  const tableWidth = () => grid.visibleColumns().reduce((sum, column) => sum + widthOf(column.key, column.initialWidth), 0)
    + (hasBulk ? widthOf('__check', null) : 0) + (hasActions ? widthOf('__actions', null) : 0);
  const moving = state<{ key: string; over: string | null; side: 'left' | 'right' } | null>(null);

  const startResize = (event: PointerEvent, column: GridColumn<R>, th: HTMLElement): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    // The first change fixes the widths of all columns, so the others do not jump
    if (!Object.keys(untrack(grid.widths)).length) {
      // Measured all first: the first width set switches the table to fixed widths
      const measured = [...headerRow.querySelectorAll<HTMLElement>('th[data-width-key]')].map(cell => [cell.dataset.widthKey!, `${cell.offsetWidth}px`]);
      grid.widths.set(Object.fromEntries(measured));
    }
    const start = event.clientX;
    const width = th.offsetWidth;
    const handle = event.currentTarget as HTMLElement;
    const tableStart = table.offsetWidth;
    handle.classList.add('phx-grid-resizing');
    table.closest('.phx-grid-wrapper')?.classList.add('phx-grid-col-resizing');
    let now = width;
    followPointer(event, table, {
      move: pointer => {
        now = Math.max(40, Math.round(width + pointer.x - start));
        th.style.width = `${now}px`;
        table.style.width = `${tableStart + now - width}px`;
      },
      end: cancelled => {
        handle.classList.remove('phx-grid-resizing');
        table.closest('.phx-grid-wrapper')?.classList.remove('phx-grid-col-resizing');
        if (!cancelled) grid.setWidth(column.key, `${now}px`);
        // The template sets the widths from the state again, also back after Escape
        th.style.width = `${widthOf(column.key, column.initialWidth)}px`;
        table.style.width = `${tableWidth()}px`;
      },
    });
  };

  const startMove = (event: PointerEvent, column: GridColumn<R>): void => {
    if (!props.reorderable || event.button !== 0 || (event.target as Element).closest('.phx-grid-resize-handle')) return;
    const start = event.clientX;
    let started = false;
    followPointer(event, table, {
      move: pointer => {
        if (!started && Math.abs(pointer.x - start) < DRAG_THRESHOLD) return;
        started = true;
        const over = document.elementFromPoint?.(pointer.x, pointer.y)?.closest<HTMLElement>('th[data-col-key]');
        if (!over || !headerRow.contains(over)) return moving.set({ key: column.key, over: null, side: 'left' });
        const box = over.getBoundingClientRect();
        moving.set({ key: column.key, over: over.dataset.colKey!, side: pointer.x < box.left + box.width / 2 ? 'left' : 'right' });
      },
      end: cancelled => {
        const target = untrack(moving);
        moving.set(null);
        if (!started) return;
        // The click that follows the release is not sorting
        const swallow = (click: MouseEvent): void => click.stopPropagation();
        window.addEventListener('click', swallow, true);
        setTimeout(() => window.removeEventListener('click', swallow, true));
        if (cancelled || !target?.over || target.over === column.key) return;
        const keys = untrack(grid.visibleColumns).map(other => other.key);
        const before = target.side === 'left' ? target.over : (keys[keys.indexOf(target.over) + 1] ?? null);
        if (before !== column.key) grid.moveColumn(column.key, before);
      },
    });
  };

  const header = (column: GridColumn<R>) => {
    const sorted = () => (grid.sort()?.field === column.key ? grid.sort()!.dir : null);
    return (
      <th
        class={() => classes(
          slot('th'), `phx-grid-col-${column.key}`, column.canSort && slot('thSortable'), sorted() && slot('thSorted'),
          column.alignment && `phx-grid-align-${column.alignment}`,
          moving()?.key === column.key && 'phx-grid-drag-source',
          moving()?.over === column.key && moving()?.key !== column.key && `phx-grid-drag-over-${moving()!.side}`,
        )}
        style={() => {
          const width = fixed() ? `${widthOf(column.key, column.initialWidth)}px` : column.initialWidth;
          return width ? `width:${width}` : null;
        }}
        scope="col"
        data-col-key={column.key}
        data-width-key={column.key}
        aria-sort={() => (column.canSort ? (sorted() === 'asc' ? 'ascending' : sorted() === 'desc' ? 'descending' : 'none') : null)}
        onPointerdown={event => startMove(event, column)}
      >
        {column.canSort ? (
          <button type="button" class={slot('sortLink')} onClick={() => run(grid.sortBy(column.key))}>
            {column.label}
            <span class={slot('sortIcon')} ref={element => effect(() => { element.innerHTML = ICONS[sorted() ?? 'none']; })} />
          </button>
        ) : column.label}
        {props.resizable ? (
          <div class="phx-grid-resize-handle" role="separator" aria-orientation="vertical" aria-label={format(texts.resize, column.label)}
            onPointerdown={event => startResize(event, column, event.currentTarget.parentElement!)} />
        ) : null}
      </th>
    );
  };

  // Rows

  const actionsCell = (row: () => R) => {
    const visible = () => grid.actions.filter(action => !action.visible || action.visible(row()));
    const primary = () => visible().filter(action => action.primary);
    const other = () => visible().filter(action => !action.primary);
    const activate = (action: GridAction<R>, event: Event): void => {
      if (!action.confirm && !action.onClick) return;
      event.preventDefault();
      run(grid.runAction(action, row()).then(async done => {
        if (!done) return;
        if (action.href) await app?.router.navigate(action.href(row()));
        else await grid.load();
      }));
    };
    const item = (action: GridAction<R>, className: string) => (action.href ? (
      <a class={classes(className, action.danger && slot('danger'))} href={action.href(row())} onClick={event => activate(action, event)}>{action.label}</a>
    ) : (
      <button type="button" class={classes(className, action.danger && slot('danger'))} onClick={event => activate(action, event)}>{action.label}</button>
    ));
    return (
      <td class={classes(slot('td'), 'phx-grid-td-actions')}>
        <div class="phx-grid-actions">
          {() => primary().map(action => item(action, slot('actionPrimary')))}
          <If when={() => other().length > 0}>
            <Popup
              class={slot('actionMenu')}
              label={texts.actions}
              button={(open, opened) => (
                <button type="button" class={slot('actionMenuToggle')} aria-label={texts.actions} title={texts.actions}
                  aria-haspopup="menu" aria-expanded={() => String(opened())} ref={icon(ICONS.menu)} onClick={open} />
              )}
              panel={close => (
                <div role="menu" onClick={() => close()}>
                  {other().map(action => item(action, slot('actionMenuItem')))}
                </div>
              )}
            />
          </If>
        </div>
      </td>
    );
  };

  const cell = (column: GridColumn<R>, row: () => R) => (
    <td class={classes(slot('td'), `phx-grid-td-${column.key}`, column.alignment && `phx-grid-align-${column.alignment}`, column.cellClass)} data-col-key={column.key}>
      {() => {
        if (column.renderer) return column.renderer(row());
        const value = column.value(row());
        if (column.type === 'bool') {
          return value ? <span class="phx-grid-bool" role="img" aria-label={texts.yes}>✓</span> : <span class="phx-grid-bool phx-grid-bool-no" role="img" aria-label={texts.no}>–</span>;
        }
        return column.text(value);
      }}
    </td>
  );

  const checkAll = (element: HTMLInputElement) => {
    effect(() => {
      const keys = grid.rows().map(row => grid.keyOf(row));
      const selected = keys.filter(key => grid.selected().includes(key)).length;
      element.checked = keys.length > 0 && selected === keys.length;
      element.indeterminate = selected > 0 && selected < keys.length;
    });
  };

  // Pages

  const pagination = () => {
    const pages = () => {
      const page = grid.page();
      const from = Math.max(1, page - 2);
      const to = Math.min(grid.pages(), page + 2);
      return Array.from({ length: to - from + 1 }, (_, index) => from + index);
    };
    const pageButton = (target: () => number, text: Child, label: () => string, disabled: () => boolean, active = () => false) => (
      <li class={() => classes(slot('pageItem'), active() && slot('pageItemActive'), disabled() && slot('pageItemDisabled'))}>
        <button type="button" class={slot('pageLink')} aria-label={label} aria-current={() => (active() ? 'page' : null)}
          disabled={disabled} onClick={() => run(grid.goTo(target()))}>{text}</button>
      </li>
    );
    return (
      <div class="phx-grid-footer">
        <nav class={slot('paginationNav')} aria-label={texts.page.replace('%d', '').trim()}>
          <span class={slot('paginationInfo')} role="status">
            {() => {
              if (!grid.total()) return '';
              const first = (grid.page() - 1) * grid.pageSize() + 1;
              return format(texts.shown, first, Math.min(first + grid.pageSize() - 1, grid.total()), grid.total());
            }}
          </span>
          <div class="phx-grid-pagination-right">
            {grid.options.pageSizes ? (
              <label class="phx-grid-per-page">
                <span class="phx-grid-per-page-label">{texts.perPage}</span>
                <select class={classes(slot('filterSelect'), 'phx-grid-per-page-select')} onChange={event => run(grid.setPageSize(Number(event.currentTarget.value)))}>
                  {grid.options.pageSizes.map(size => <option value={String(size)} selected={() => grid.pageSize() === size}>{String(size)}</option>)}
                </select>
              </label>
            ) : null}
            <If when={() => grid.pages() > 1}>
              <ul class={slot('paginationList')}>
                {pageButton(() => 1, '«', () => texts.first, () => grid.page() <= 1)}
                {pageButton(() => grid.page() - 1, '‹', () => texts.previous, () => grid.page() <= 1)}
                <For each={pages}>
                  {page => pageButton(() => page, String(page), () => format(texts.page, page), () => false, () => grid.page() === page)}
                </For>
                {pageButton(() => grid.page() + 1, '›', () => texts.next, () => grid.page() >= grid.pages())}
                {pageButton(() => grid.pages(), '»', () => texts.last, () => grid.page() >= grid.pages())}
              </ul>
            </If>
          </div>
        </nav>
      </div>
    );
  };

  return (
    <div class={classes('phx-grid-wrapper', props.class)} data-datagrid>
      {toolbar}
      {bulkBar}
      <div class={slot('tableWrapper')}>
        <table
          class={() => classes(slot('table'), fixed() && 'phx-grid-table-fixed', grid.loading() && 'phx-grid-loading')}
          // With fixed widths the table is as wide as its columns, so a column grows by as much as it is dragged
          style={() => (fixed() ? `width:${tableWidth()}px` : null)}
          aria-label={props['aria-label'] ?? null}
          aria-busy={() => (grid.loading() ? 'true' : null)}
          ref={element => { table = element; }}
        >
          <thead class={slot('thead')}>
            <tr ref={element => { headerRow = element; }}>
              {hasBulk ? (
                <th class={classes(slot('th'), 'phx-grid-th-check')} scope="col" data-width-key="__check"
                  style={() => (fixed() ? `width:${widthOf('__check', null)}px` : null)}>
                  <input type="checkbox" class={classes(slot('check'), 'phx-grid-check-all')} aria-label={texts.selectAll} title={texts.selectAll}
                    ref={checkAll} onChange={event => grid.togglePage(event.currentTarget.checked)} />
                </th>
              ) : null}
              <For each={grid.visibleColumns}>{column => header(column)}</For>
              {hasActions ? (
                <th class={classes(slot('th'), 'phx-grid-th-actions')} scope="col" data-width-key="__actions"
                  style={() => (fixed() ? `width:${widthOf('__actions', null)}px` : null)}>
                  <span class="phx-grid-visually-hidden">{texts.actions}</span>
                </th>
              ) : null}
            </tr>
            <If when={hasFilters}>
              <tr class="phx-grid-filter-row">
                {hasBulk ? <th class={slot('thFilterCell')} /> : null}
                <For each={grid.visibleColumns}>
                  {column => (
                    <th class={classes(slot('thFilterCell'), 'phx-grid-filter-th')} data-col-key={column.key}>
                      {column.filterKind ? (
                        <div class="phx-grid-filter-cell-wrap">
                          {filterControl(column)}
                          {clearButton(column)}
                        </div>
                      ) : null}
                    </th>
                  )}
                </For>
                {hasActions ? <th class={slot('thFilterCell')} /> : null}
              </tr>
            </If>
          </thead>
          <tbody>
            <If when={() => grid.rows().length > 0}>
              <For each={grid.rows} key={row => grid.keyOf(row)}>
                {row => (
                  <tr class={() => classes(hasBulk && grid.isSelected(row()) && slot('rowSelected'))}>
                    {hasBulk ? (
                      <td class={classes(slot('td'), 'phx-grid-td-check')}>
                        <input type="checkbox" class={classes(slot('check'), 'phx-grid-row-check')} aria-label={texts.selectRow}
                          checked={() => grid.isSelected(row())} onChange={event => grid.toggleRow(row(), event.currentTarget.checked)} />
                      </td>
                    ) : null}
                    <For each={grid.visibleColumns}>{column => cell(column, row)}</For>
                    {hasActions ? actionsCell(row) : null}
                  </tr>
                )}
              </For>
              <Else />
              <tr class="phx-grid-empty-row">
                <td colSpan={span} class={slot('noData')}>{() => (grid.loading() ? texts.loading : texts.noData)}</td>
              </tr>
            </If>
          </tbody>
          {hasFooter ? (
            <tfoot>
              <tr class="phx-grid-footer-row">
                {hasBulk ? <td class={classes(slot('td'), 'phx-grid-td-check phx-grid-td-footer')} /> : null}
                <For each={grid.visibleColumns}>
                  {column => (
                    <td class={classes(slot('td'), 'phx-grid-td-footer', column.alignment && `phx-grid-align-${column.alignment}`)} data-col-key={column.key}>
                      {() => {
                        const value = column.aggregateFn ? grid.aggregates()[column.key]?.[column.aggregateFn] : undefined;
                        if (value === undefined) return null;
                        return [
                          <small class="phx-grid-footer-label">{texts[column.aggregateFn!]}</small>,
                          <strong>{column.aggregateFn === 'count' ? String(value) : column.text(value)}</strong>,
                        ];
                      }}
                    </td>
                  )}
                </For>
                {hasActions ? <td class={classes(slot('td'), 'phx-grid-td-footer')} /> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {pagination()}
    </div>
  );
}
