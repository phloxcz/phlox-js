/**
 * The Kendo adapter against a fake Kendo with the same shape (constructors in kendo.ui, value(), bind()…).
 * The real Kendo UI is checked in the browser, examples/kendo.
 */
import { describe, expect, test } from 'vitest';
import { Component, Container, If, Presenter, state } from '../src/index';
import { Form, FormView } from '../src/forms/index';
import { Kendo, KendoControl, KendoDialogs, KendoGrid, KendoWidget } from '../src/adapters/kendo/index';
import { boot, tick } from './helpers';

const made: FakeWidget[] = [];

class FakeWidget {
  element: HTMLElement[];
  handlers: Record<string, (event: any) => void> = {};
  current: unknown = null;
  enabled = true;
  destroyed = false;
  constructor(element: HTMLElement, readonly options: Record<string, any>) {
    this.element = [element];
    made.push(this);
  }
  bind(event: string, handler: (event: any) => void) { this.handlers[event] = handler; }
  value(next?: unknown) {
    if (arguments.length === 0) return this.current;
    this.current = next;
    return undefined;
  }
  enable(on: boolean) { this.enabled = on; }
  destroy() { this.destroyed = true; }
  /** What the user does in the widget. */
  userSets(next: unknown) {
    this.current = next;
    this.handlers.change?.({});
  }
}

class FakeGrid extends FakeWidget {
  rows: Record<string, any>[] = [];
  selected: Element | null = null;
  dataSource = { data: (items?: object[]) => { if (items) this.draw(items as Record<string, any>[]); return this.rows; } };
  constructor(element: HTMLElement, options: Record<string, any>) {
    super(element, options);
    this.draw(options.dataSource?.data ?? []);
  }
  draw(items: Record<string, any>[]) {
    this.rows = items;
    const cell = (column: Record<string, any>, item: Record<string, any>) => (column.template ? column.template(item) : String(item[column.field]));
    this.element[0]!.innerHTML = `<table>${items.map(item =>
      `<tr>${this.options.columns.map((column: Record<string, any>) => `<td>${cell(column, item)}</td>`).join('')}</tr>`).join('')}</table>`;
    this.options.dataBound?.({});
  }
  dataItem(row: Element) { return this.rows[[...this.element[0]!.querySelectorAll('tr')].indexOf(row as HTMLTableRowElement)]; }
  select() { return this.selected ? [this.selected] : []; }
}

class FakeWindow extends FakeWidget {
  heading = '';
  opened = false;
  wrapper: HTMLElement[];
  constructor(element: HTMLElement, options: Record<string, any>) {
    super(element, options);
    this.wrapper = [document.createElement('div')];
  }
  title(text: string) { this.heading = text; }
  center() { return this; }
  open() { this.opened = true; return this; }
  override destroy() { super.destroy(); this.element[0]!.remove(); }
  /** × or Escape of Kendo. */
  userCloses() {
    let prevented = false;
    this.options.close({ userTriggered: true, preventDefault: () => { prevented = true; } });
    return prevented;
  }
}

const kendo = () => new Kendo({ ui: { DatePicker: FakeWidget, DropDownList: FakeWidget, Editor: FakeWidget, Grid: FakeGrid, Window: FakeWindow } });
const last = <W extends FakeWidget>() => made.at(-1) as W;

describe('KendoWidget', () => {
  test('made in the page on its element, the value both ways, enabled follows state, destroyed with its part', async () => {
    made.length = 0;
    const date = state<string | null>('2026-11-13');
    const editing = state(true);
    const shown = state(true);
    class Page extends Presenter {
      render() {
        return <main><If when={shown}><KendoWidget widget="DatePicker" options={{ format: 'd. M. yyyy' }} value={date} enabled={editing} id="due" /></If></main>;
      }
    }
    const { element } = await boot(Page, '/', new Container().add(kendo()));
    await tick();
    const widget = last();
    expect(widget.element[0]!.tagName).toBe('INPUT');
    expect(widget.element[0]!.id).toBe('due');
    expect(widget.options.format).toBe('d. M. yyyy');
    expect(widget.current).toBe('2026-11-13');

    date.set('2026-12-24');
    expect(widget.current).toBe('2026-12-24');
    widget.userSets('2027-01-01');
    expect(date()).toBe('2027-01-01');
    editing.set(false);
    expect(widget.enabled).toBe(false);

    shown.set(false);
    expect(widget.destroyed).toBe(true);
    expect(element.querySelector('.phlox-kendo')).toBeNull();
  });

  test('a widget without a value is made on a div; a missing widget is a clear error', async () => {
    made.length = 0;
    class Page extends Presenter {
      render() { return <KendoWidget widget="Editor" />; }
    }
    await boot(Page, '/', new Container().add(kendo()));
    await tick();
    expect(last().element[0]!.tagName).toBe('DIV');
    expect(() => kendo().create('Nothing', document.createElement('div'))).toThrow("Kendo UI has no widget 'Nothing'");
  });
});

describe('KendoGrid', () => {
  interface Order { id: number; customer: string }

  test('rows from state, cells as templates of the framework, the chosen row as the original object', async () => {
    made.length = 0;
    const orders = state<Order[]>([{ id: 1, customer: 'Alza' }, { id: 2, customer: 'Rako' }]);
    let chosen: Order | null = null;
    class Page extends Presenter {
      render() {
        return (
          <KendoGrid<Order>
            data={orders}
            options={{ selectable: 'row' }}
            columns={[
              { field: 'id', title: 'Číslo' },
              { title: 'Zákazník', render: order => <a href={this.link(`/orders/${order.id}`)}>{order.customer}</a> },
            ]}
            onSelect={order => { chosen = order; }}
          />
        );
      }
    }
    const { element } = await boot(Page, '/', new Container().add(kendo()));
    await tick();
    const links = () => [...element.querySelectorAll('a')].map(link => `${link.textContent} ${link.getAttribute('href')}`);
    expect(links()).toEqual(['Alza /orders/1', 'Rako /orders/2']);

    orders.set([{ id: 3, customer: 'Petrof' }]);
    expect(links()).toEqual(['Petrof /orders/3']);

    const grid = last<FakeGrid>();
    grid.selected = element.querySelector('tr');
    grid.handlers.change!({});
    expect(chosen).toBe(orders()[0]);
  });
});

describe('KendoDialogs and KendoControl', () => {
  class Edit extends Component<{}, string> {
    form = new Form<{ due: string | null; city: number | null }>();
    due = this.form.addControl('due', new KendoControl<string>('DatePicker', 'Termín')).setRequired('Vyberte termín.');
    override title() { return 'Úprava'; }
    override actions() { return <button type="button" id="save" onClick={() => this.close('uloženo')}>Uložit</button>; }
    render() { return <FormView form={this.form} />; }
  }

  test('the dialog in Kendo Window: title, content, buttons; × of Kendo asks the component, close() removes it', async () => {
    made.length = 0;
    class Page extends Presenter {
      render() { return <main />; }
    }
    const { app } = await boot(Page, '/', new Container().add(kendo(), KendoDialogs));
    const result = app.presenter!.openDialog(Edit, {});
    await tick();
    const window = made.find(widget => widget instanceof FakeWindow) as FakeWindow;
    expect(window.heading).toBe('Úprava');
    expect(window.opened).toBe(true);
    expect(window.options.modal).toBe(true);
    expect(window.element[0]!.querySelector('#save')).not.toBeNull();

    // The user closes: the framework decides (here no changes, so it closes)
    expect(window.userCloses()).toBe(true);
    expect(await result).toBeUndefined();
    expect(window.destroyed).toBe(true);

    const saved = app.presenter!.openDialog(Edit, {}, { placement: 'end' });
    await tick();
    const panel = made.filter(widget => widget instanceof FakeWindow).at(-1) as FakeWindow;
    expect(panel.wrapper[0]!.classList.contains('phlox-kendo-panel-end')).toBe(true);
    panel.element[0]!.querySelector<HTMLButtonElement>('#save')!.click();
    expect(await saved).toBe('uloženo');
  });

  test('KendoControl: rules, the value from the widget, defaults into the widget', async () => {
    made.length = 0;
    const form = new Form<{ due: string | null }>();
    const due = form.addControl('due', new KendoControl<string>('DatePicker', 'Termín')).setRequired('Vyberte termín.');
    class Page extends Presenter {
      render() { return <FormView form={form} />; }
    }
    const { element } = await boot(Page, '/', new Container().add(kendo()));
    await tick();
    const widget = last();
    expect(element.querySelector('label')!.getAttribute('for')).toBe(widget.element[0]!.id);
    expect(await form.submit()).toBe(false);
    expect(due.errors()).toEqual(['Vyberte termín.']);

    widget.userSets('2026-11-20');
    expect(due.getValue()).toBe('2026-11-20');
    expect(due.errors()).toEqual([]);

    form.setDefaults({ due: '2026-12-01' });
    expect(widget.current).toBe('2026-12-01');
    due.setDisabled();
    expect(widget.enabled).toBe(false);
  });
});
