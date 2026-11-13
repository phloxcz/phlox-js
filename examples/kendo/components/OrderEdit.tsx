import { Button, Component } from 'phlox-js';
import { Form, FormView } from 'phlox-js/forms';
import { KendoControl } from 'phlox-js/adapters/kendo';
import { Orders, STATUSES } from '../model/Orders';
import type { Order, Status } from '../model/Orders';

interface OrderInput {
  customer: string;
  date: Date | null;
  price: number | null;
  status: Status | null;
}

/**
 * Editing an order in Kendo Window. The customer is a field of the framework, the date, the price and
 * the state are widgets of Kendo (KendoControl); rules, errors and unsaved changes work for all of them.
 */
export class OrderEdit extends Component<{ id: number }, boolean> {
  form = new Form<OrderInput>();
  private order: Order | null = null;

  constructor(private orders: Orders) {
    super();
    this.form.addText('customer', 'Zákazník').setRequired('Vyplňte zákazníka.');
    this.form.addControl('date', new KendoControl<Date>('DatePicker', 'Datum', { format: 'd. M. yyyy' }))
      .setRequired('Vyberte datum.');
    this.form.addControl('price', new KendoControl<number>('NumericTextBox', 'Cena', { format: 'n0', min: 0, step: 100 }))
      .setRequired('Vyplňte cenu.');
    this.form.addControl('status', new KendoControl<Status>('DropDownList', 'Stav', {
      dataSource: STATUSES, dataTextField: 'text', dataValueField: 'value',
    }));
    this.form.onSuccess = async input => {
      const date = input.date!;
      await this.orders.save({
        ...this.order!,
        customer: input.customer,
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        price: input.price!,
        status: input.status ?? 'new',
      });
      this.close(true);
    };
  }

  override async startup() {
    const order = this.order = await this.orders.get(this.props.id);
    if (!order) throw new Error(`Objednávka ${this.props.id} neexistuje.`);
    const [year, month, day] = order.date.split('-').map(Number) as [number, number, number];
    this.form.setDefaults({ customer: order.customer, date: new Date(year, month - 1, day), price: order.price, status: order.status });
  }

  override hasUnsavedChanges() {
    return this.form.isChanged();
  }

  override title() {
    return `Objednávka ${this.props.id}`;
  }

  override actions() {
    return <>
      <Button onClick={() => this.cancel()}>Zrušit</Button>
      <Button primary disabled={this.form.submitting} onClick={() => this.form.submit()}>Uložit</Button>
    </>;
  }

  render() {
    return <FormView form={this.form} />;
  }
}
