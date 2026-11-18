import { Component } from '@phloxcz/phlox-js';
import { Grid, GridView } from '@phloxcz/phlox-js/components';
import { CATEGORIES, ORDERS } from './_orders';
import type { Order } from './_orders';

const money = new Intl.NumberFormat('cs', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 });

/** Data in the browser: the grid searches, filters, sorts, sums and pages by itself. */
export default class LocalGrid extends Component {
  public readonly grid = new Grid<Order>({ rows: ORDERS, pageSize: 8 });

  public constructor() {
    super();
    const grid = this.grid;
    grid.addNumberColumn('id', 'Číslo').sortable().width('6rem').format(id => String(id));
    grid.addTextColumn('customer', 'Zákazník').sortable().filterable().searchable();
    grid.addTextColumn('category', 'Kategorie').sortable().filterSelect(CATEGORIES, true);
    grid.addNumberColumn('price', 'Cena').sortable().filterable().format(price => money.format(price)).aggregate('sum');
    grid.addDateColumn('created', 'Vytvořeno').sortable().filterable();
    grid.addBoolColumn('paid', 'Zaplaceno').sortable().filterable();
  }

  public render() {
    return <GridView grid={this.grid} search aria-label="Objednávky" />;
  }
}
