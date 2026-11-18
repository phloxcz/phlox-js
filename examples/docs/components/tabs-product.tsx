import { Button, Component, Tab, Tabs } from '@phloxcz/phlox-js';
import { Form, FormErrors, FormTag, Input, InputError, Label } from '@phloxcz/phlox-js/forms';
import type { TextInput } from '@phloxcz/phlox-js/forms';

interface Product {
  name: string;
  link: string;
  price: number | null;
  code: string;
}

/**
 * A form of a product in tabs. "Uložit" with an empty code opens the tab "Systémové" with the error.
 * There are more tabs than fit: the rest is behind "Další"; make the window narrower and more go there.
 */
export default class ProductTabs extends Component {
  public readonly form = new Form<Product>();

  public constructor() {
    super();
    this.form.addText('name', 'Název').setRequired('Vyplňte název.');
    this.form.addText('link', 'Odkaz');
    this.form.addFloat('price', 'Cena');
    this.form.addText('code', 'Kód produktu').setRequired('Vyplňte kód produktu.');
    this.form.setDefaults({ name: 'Brazílie Cerrado', link: 'brazilie-cerrado', price: 289, code: '' });
    this.form.onSuccess = () => this.flashMessage('Uloženo.', 'success');
  }

  public render() {
    const field = (name: keyof Product) => {
      const control = this.form.get(name) as TextInput<string>;
      return <div class="mb-3"><Label control={control} /><Input control={control} /><InputError control={control} /></div>;
    };
    const empty = (text: string) => <p class="text-body-secondary">{text}</p>;
    return (
      <FormTag form={this.form}>
        <FormErrors form={this.form} />
        <Tabs aria-label="Produkt">
          <Tab title="Název a popis">{field('name')}{field('link')}</Tab>
          <Tab title="Varianty">{empty('Varianty produktu.')}</Tab>
          <Tab title="Historie cen">{field('price')}</Tab>
          <Tab title="Zařazení">{empty('Kategorie a štítky.')}</Tab>
          <Tab title="Parametry">{empty('Parametry produktu.')}</Tab>
          <Tab title="Komentáře a hodnocení">{empty('Komentáře zákazníků.')}</Tab>
          <Tab title="Vracení zboží">{empty('Žádosti o vrácení.')}</Tab>
          <Tab title="Systémové">{field('code')}</Tab>
        </Tabs>
        <Button primary type="submit">Uložit</Button>
      </FormTag>
    );
  }
}
