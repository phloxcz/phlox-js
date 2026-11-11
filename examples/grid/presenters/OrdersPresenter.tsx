import { Presenter } from 'phlox-js';
import type { Route } from 'phlox-js';
import { Grid, GridView } from 'phlox-js/components';
import { CATEGORIES, OrderStore } from '../model/OrderStore';
import type { Order } from '../model/OrderStore';
import { OrderDetail } from '../components/OrderDetail';
import { AppearanceSwitch } from '../../shared/appearance';

const money = new Intl.NumberFormat('cs', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 });

/**
 * Orders in a grid. Its state (page, sorting, search, filters) is in the URL: a link shows the same,
 * Back returns it. The detail of an order is a routed dialog at /1001, which keeps the state of the grid.
 */
export class OrdersPresenter extends Presenter {
  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    {
      name: 'detail',
      pattern: '/<id \\d+>',
      dialog: ({ id }) => [OrderDetail, { id: Number(id) }],
      closed: changed => {
        if (changed) void this.grid.load();
      },
    },
  ];

  readonly grid = new Grid<Order>({
    load: query => this.store.list(query),
    pageSize: 10,
    pageSizes: [10, 20, 50],
    remember: 'orders',
  });

  constructor(private store: OrderStore) {
    super();
    const grid = this.grid;
    grid.addNumberColumn('id', 'Číslo').sortable().width('6rem').alwaysVisible().format(id => String(id));
    grid.addTextColumn('customer', 'Zákazník').sortable().filterable();
    grid.addColumn('product', 'Produkt', order => <a href={this.link('detail', { id: order.id })}>{order.product}</a>).sortable().filterable();
    grid.addTextColumn('category', 'Kategorie').sortable().filterSelect(CATEGORIES, true);
    grid.addTextColumn('owner', 'Obchodník').sortable().filterDropDown({ search: text => this.store.owners(text) });
    grid.addNumberColumn('price', 'Cena').sortable().filterable().format(price => money.format(price)).aggregate('sum');
    grid.addDateColumn('created', 'Vytvořeno').sortable().filterable();
    grid.addBoolColumn('paid', 'Zaplaceno').sortable().filterable();

    grid.addAction('Detail', { href: order => this.link('detail', { id: order.id }), primary: true });
    grid.addAction('Označit zaplacenou', { onClick: order => this.store.setPaid([order.id], true), visible: order => !order.paid });
    grid.addAction('Smazat', { onClick: order => this.store.remove([order.id]), danger: true, confirm: order => `Smazat objednávku ${order.id}?` });

    grid.addBulkAction('Označit zaplacené', keys => this.store.setPaid(keys as number[], true));
    grid.addBulkAction('Smazat', keys => this.store.remove(keys as number[]), { danger: true, confirm: 'Smazat vybrané objednávky?' });

    // The state goes to the URL, and links of this presenter (the detail) keep it.
    // The grid asks before deleting by a popover at the button that asked.
    grid.bind(this);
  }

  render() {
    return (
      <main>
        <h1>Objednávky</h1>
        <GridView grid={this.grid} search resizable reorderable columnToggle aria-label="Objednávky" />
        <p class="hint">
          Záhlaví sloupce jde přetáhnout jinam a za jeho pravý okraj změnit šířku; obojí si prohlížeč pamatuje.
          Řazení, hledání, filtry i stránka jsou v adrese, takže je jde poslat odkazem.
        </p>
        <AppearanceSwitch />
      </main>
    );
  }
}
