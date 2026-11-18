import { BadRequestError, Button, Component, Presenter, state } from '@phloxcz/phlox-js';
import type { Container, Route } from '@phloxcz/phlox-js';
import { Grid, GridView } from '@phloxcz/phlox-js/components';
import { CATEGORIES, OrderStore } from './_orders';
import type { Order } from './_orders';

const money = new Intl.NumberFormat('cs', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 });

export function services(container: Container) {
  container.add(OrderStore);
}

/** An order at /1001, a routed dialog over the grid; true when it changed the order. */
class OrderDetail extends Component<{ id: number }, boolean> {
  public readonly order = state<Order | null>(null);

  public constructor(private store: OrderStore) {
    super();
  }

  public override async startup() {
    const order = await this.store.get(this.props.id);
    if (!order) throw new BadRequestError(404, `Objednávka ${this.props.id} neexistuje.`);
    this.order.set(order);
  }

  public override title() {
    return `Objednávka ${this.props.id}`;
  }

  public override actions() {
    return <>
      <Button onClick={() => this.close(false)}>Zavřít</Button>
      <Button primary disabled={() => this.order()?.paid ?? true} onClick={() => this.handlePaid()}>Označit zaplacenou</Button>
    </>;
  }

  public async handlePaid() {
    await this.store.setPaid([this.props.id], true);
    this.close(true);
  }

  public render() {
    const order = this.order()!;
    return <p>{order.customer}: {order.product} ({order.category}), {money.format(order.price)}, {order.paid ? 'zaplaceno' : 'nezaplaceno'}</p>;
  }
}

/**
 * Data from the server, the state (page, sorting, search, filters) in the URL, the detail as a routed dialog
 * that keeps the state, actions in rows, bulk actions, columns resized, moved and hidden.
 */
export default class OrdersPresenter extends Presenter {
  public override routes: Route[] = [
    { name: 'default', pattern: '/' },
    {
      name: 'detail',
      pattern: '/<id:int>',
      dialog: ({ id }) => [OrderDetail, { id: Number(id) }],
      closed: changed => {
        if (changed) void this.grid.load();
      },
    },
  ];

  public readonly grid = new Grid<Order>({
    load: query => this.store.list(query),
    pageSize: 10,
    pageSizes: [10, 20, 50],
    remember: 'docs-orders',
  });

  public constructor(private store: OrderStore) {
    super();
    const grid = this.grid;
    grid.addNumberColumn('id', 'Číslo').sortable().width('6rem').alwaysVisible().format(id => String(id));
    grid.addTextColumn('customer', 'Zákazník').sortable().filterable();
    grid.addColumn('product', 'Produkt', order => <a href={this.link('detail', { id: order.id })}>{order.product}</a>).sortable().filterable();
    grid.addTextColumn('category', 'Kategorie').sortable().filterSelect(CATEGORIES, true);
    grid.addTextColumn('owner', 'Obchodník').sortable().filterDropDown({ search: text => this.store.owners(text) });
    grid.addNumberColumn('price', 'Cena').sortable().filterable().format(price => money.format(price)).aggregate('sum');
    grid.addBoolColumn('paid', 'Zaplaceno').sortable().filterable();

    grid.addAction('Detail', { href: order => this.link('detail', { id: order.id }), primary: true });
    grid.addAction('Označit zaplacenou', { onClick: order => this.store.setPaid([order.id], true), visible: order => !order.paid });
    grid.addAction('Smazat', { onClick: order => this.store.remove([order.id]), danger: true, confirm: order => `Smazat objednávku ${order.id}?` });
    grid.addBulkAction('Označit zaplacené', keys => this.store.setPaid(keys as number[], true));
    grid.addBulkAction('Smazat', keys => this.store.remove(keys as number[]), { danger: true, confirm: 'Smazat vybrané objednávky?' });

    // The state goes to the URL and links of this presenter (the detail) keep it
    grid.bind(this);
  }

  public render() {
    return <GridView grid={this.grid} search resizable reorderable columnToggle aria-label="Objednávky" />;
  }
}
