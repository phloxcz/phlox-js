import { Component, computed } from '@phloxcz/phlox-js';
import { Form, FormView } from '@phloxcz/phlox-js/forms';
import { searchPeople } from './_people';

interface Values { contact: number | null; shop: string | null }

const SHOPS = ['Albert', 'Billa', 'Globus', 'Kaufland', 'Lidl', 'Penny', 'Tesco'];

/** Typing right into the field: a value from suggestions, or with allowCustom the typed text. */
export default class ComboBoxes extends Component {
  public readonly form = new Form<Values>();
  public readonly values = computed(() => JSON.stringify(this.form.getValues()));
  // addComboBox() gives the ComboBox itself, form.get() only a FormControl
  public readonly shop = this.form.addComboBox('shop', 'Obchod (allowCustom)', { items: SHOPS, allowCustom: true });

  public constructor() {
    super();
    this.form.addComboBox('contact', 'Kontakt (search)', {
      search: async text => (await searchPeople(text)).map(person => [person.id, person.name] as const),
      placeholder: 'Začněte psát jméno',
    });
  }

  public render() {
    return (
      <div>
        <FormView form={this.form} />
        <p><code>{this.values}</code>, vlastní text: {() => String(this.shop.isCustom())}</p>
      </div>
    );
  }
}
