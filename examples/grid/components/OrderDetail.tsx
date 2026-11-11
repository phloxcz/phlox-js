import { BadRequestError, Button, Component, state } from 'phlox-js';
import { OrderStore } from '../model/OrderStore';
import type { Order } from '../model/OrderStore';

/** An order at /1001, a routed dialog over the grid. It returns true when the order was changed. */
export class OrderDetail extends Component<{ id: number }, boolean> {
  readonly order = state<Order | null>(null);

  constructor(private store: OrderStore) {
    super();
  }

  override async startup() {
    const order = await this.store.get(this.props.id);
    if (!order) throw new BadRequestError(404, `Objednávka ${this.props.id} neexistuje.`);
    this.order.set(order);
  }

  override title() {
    return `Objednávka ${this.props.id}`;
  }

  override actions() {
    return (
      <>
        <Button onClick={() => this.close(false)}>Zavřít</Button>
        <Button primary disabled={() => this.order()?.paid ?? true} onClick={() => void this.handlePaid()}>Označit zaplacenou</Button>
      </>
    );
  }

  async handlePaid() {
    await this.store.setPaid([this.props.id], true);
    this.close(true);
  }

  render() {
    const order = this.order()!;
    return (
      <dl class="detail">
        <dt>Zákazník</dt><dd>{order.customer}</dd>
        <dt>Produkt</dt><dd>{order.product} ({order.category})</dd>
        <dt>Obchodník</dt><dd>{order.owner}</dd>
        <dt>Cena</dt><dd>{order.price.toLocaleString('cs')} Kč</dd>
        <dt>Vytvořeno</dt><dd>{new Date(order.created).toLocaleDateString('cs')}</dd>
        <dt>Zaplaceno</dt><dd>{order.paid ? 'ano' : 'ne'}</dd>
      </dl>
    );
  }
}
