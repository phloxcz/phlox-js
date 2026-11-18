import { Component, computed } from '@phloxcz/phlox-js';
import { Form, FormView } from '@phloxcz/phlox-js/forms';
import { readPerson, searchPeople } from './_people';

interface Values { category: string | null; assignee: number | null }

const CATEGORIES = ['Nápoje', 'Pečivo', 'Mléčné výrobky', 'Ovoce a zelenina', 'Maso', 'Drogerie'];

/** Fixed items searched in the browser, and items from a server with the label of a saved value. */
export default class DropDownLists extends Component {
  public readonly form = new Form<Values>();
  public readonly values = computed(() => JSON.stringify(this.form.getValues()));

  public constructor() {
    super();
    this.form.addDropDownList('category', 'Kategorie (items)', { items: CATEGORIES, placeholder: 'Vyberte' });
    this.form.addDropDownList('assignee', 'Řešitel (search ze serveru)', {
      search: async text => (await searchPeople(text)).map(person => [person.id, person.name] as const),
      label: async id => (await readPerson(id)).name,   // the label of a value set by code, not among the loaded ones
      placeholder: 'Vyberte řešitele',
    }).setRequired('Vyberte řešitele.');
    // A saved value from the server: person 250 is not among the first 20, its label comes from label()
    this.form.setDefaults({ assignee: 250 });
  }

  public render() {
    return <div><FormView form={this.form} /><p><code>{this.values}</code></p></div>;
  }
}
