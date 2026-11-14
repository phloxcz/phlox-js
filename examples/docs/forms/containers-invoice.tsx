import { Component, computed } from '@phloxcz/phlox-js';
import { Form, FormView } from '@phloxcz/phlox-js/forms';
import type { Multiplier } from '@phloxcz/phlox-js/forms';

interface Line { name: string; quantity: number | null; price: number | null }
interface Invoice { number: string; customer: { name: string; city: string }; lines: Line[] }

/** A nested object (a container) and rows the user adds, removes and sorts (a multiplier), a live total. */
export default class InvoiceForm extends Component {
  readonly form = new Form<Invoice>();
  readonly lines: Multiplier<Line>;
  readonly total = computed(() => this.lines.getValues().reduce((sum, line) => sum + (line.quantity ?? 0) * (line.price ?? 0), 0));

  constructor() {
    super();
    this.form.addText('number', 'Číslo faktury').setRequired('Vyplňte číslo.');
    const customer = this.form.addContainer('customer', 'Odběratel');
    customer.addText('name', 'Název').setRequired('Vyplňte odběratele.');
    customer.addText('city', 'Město');
    this.lines = this.form.addMultiplier('lines', line => {
      line.addText('name', 'Položka').setRequired('Vyplňte položku.');
      line.addInteger('quantity', 'Množství').addRule(Form.Min, 'Aspoň %d.', 1);
      line.addFloat('price', 'Cena');
    }, { min: 1, max: 5, label: 'Řádky' });
    this.form.addSubmit('save', 'Uložit');
    this.form.setDefaults({ number: '2026-001', lines: [{ name: 'Konzultace', quantity: 2, price: 1500 }, { name: 'Doprava', quantity: 1, price: 300 }] });
    this.form.onSuccess = values => this.alert(<pre>{JSON.stringify(values, null, 1)}</pre>, { title: 'Hodnoty' });
  }

  render() {
    return (
      <div>
        <FormView form={this.form} />
        <p>Celkem: <strong>{() => this.total().toLocaleString('cs')} Kč</strong></p>
      </div>
    );
  }
}
