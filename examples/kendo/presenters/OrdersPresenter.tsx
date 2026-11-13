import { Presenter, computed, state } from 'phlox-js';
import type { Route } from 'phlox-js';
import { foldText } from 'phlox-js/forms';
import { KendoGrid, KendoWidget } from 'phlox-js/adapters/kendo';
import { OrderEdit } from '../components/OrderEdit';
import { Orders, STATUSES } from '../model/Orders';
import type { Order, Status } from '../model/Orders';

const STATUS_TEXT = Object.fromEntries(STATUSES.map(status => [status.value, status.text])) as Record<Status, string>;

/**
 * Orders in Kendo Grid at /. The search is a field of the framework, the state a DropDownList of Kendo;
 * both are state, the grid shows what they let through. /<id> edits an order in Kendo Window.
 */
export class OrdersPresenter extends Presenter {
  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'edit', pattern: '/<id \\d+>', dialog: ({ id }) => [OrderEdit, { id: Number(id) }] },
  ];

  readonly search = state('');
  /** The state chosen in the DropDownList of Kendo, '' for all. */
  readonly status = state<Status | ''>('');
  readonly shown = computed(() => {
    const words = foldText(this.search().trim());
    return this.orders.all().filter(order => (!this.status() || order.status === this.status())
      && foldText(`${order.id} ${order.customer}`).includes(words));
  });

  constructor(private orders: Orders) {
    super();
  }

  override pageTitle() {
    return 'Objednávky';
  }

  render() {
    return (
      <section>
        <h1>Objednávky v Kendo Gridu</h1>
        <div class="toolbar">
          <label>
            Hledat
            <input class="form-control" type="search" placeholder="Číslo nebo zákazník" value={this.search}
              onInput={event => this.search.set(event.currentTarget.value)} />
          </label>
          <label>
            Stav (Kendo DropDownList)
            <KendoWidget widget="DropDownList" value={this.status} options={{
              dataSource: [{ value: '', text: 'Všechny' }, ...STATUSES], dataTextField: 'text', dataValueField: 'value',
            }} />
          </label>
          <span>{() => `Zobrazeno ${this.shown().length} z ${this.orders.all().length}`}</span>
        </div>
        <KendoGrid<Order>
          data={this.shown}
          options={{ sortable: true, pageable: { pageSize: 10 }, height: 520, dataSource: { pageSize: 10 } }}
          columns={[
            { field: 'id', title: 'Číslo', width: 100 },
            // A cell made by the framework: a link the application handles itself
            { field: 'customer', title: 'Zákazník', render: order => <a href={this.link('edit', { id: order.id })}>{order.customer}</a> },
            { field: 'date', title: 'Datum', width: 140, template: (order: Order) => new Date(order.date).toLocaleDateString('cs-CZ') },
            { field: 'price', title: 'Cena', width: 140, format: '{0:n0} Kč', attributes: { class: 'text-end' } },
            { field: 'status', title: 'Stav', width: 140, template: (order: Order) => STATUS_TEXT[order.status] },
          ]}
        />
        <p class="hint">
          Hledání je pole frameworku, výběr stavu widget Kenda; obojí je state a grid se podle něj mění. Klik na zákazníka otevře úpravu
          v Kendo Window (dialog frameworku s URL). Zpět ho zavře, rozepsané změny se před zavřením zeptají.
        </p>
      </section>
    );
  }
}
