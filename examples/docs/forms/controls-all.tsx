import { Component, computed } from '@phloxcz/phlox-js';
import { Form, FormView } from '@phloxcz/phlox-js/forms';

interface Values {
  text: string;
  note: string;
  email: string;
  password: string;
  count: number | null;
  price: number | null;
  date: string | null;
  agree: boolean;
  size: string | null;
  color: string | null;
  tags: string[];
  days: string[];
  token: string;
}

/** The basic controls and the value each of them gives, live. */
export default class AllControls extends Component {
  readonly form = new Form<Values>();
  readonly values = computed(() => JSON.stringify(this.form.getValues(), null, 1));

  constructor() {
    super();
    const f = this.form;
    f.addText('text', 'addText');
    f.addTextArea('note', 'addTextArea');
    f.addEmail('email', 'addEmail');
    f.addPassword('password', 'addPassword');
    f.addInteger('count', 'addInteger');
    f.addFloat('price', 'addFloat (i s čárkou)');
    f.addDate('date', 'addDate');
    f.addCheckbox('agree', 'addCheckbox');
    f.addSelect('size', 'addSelect', ['S', 'M', 'L']).setPrompt('–');
    f.addRadioList('color', 'addRadioList', { red: 'Červená', blue: 'Modrá' });
    f.addMultiSelect('tags', 'addMultiSelect', ['nový', 'akce', 'výprodej']);
    f.addCheckboxList('days', 'addCheckboxList', { mon: 'Po', tue: 'Út', wed: 'St' });
    f.addHidden('token', 'abc123');
  }

  render() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 14rem)', gap: '1rem' }}>
        <FormView form={this.form} />
        <pre style={{ margin: 0, fontSize: '.8rem' }}>{this.values}</pre>
      </div>
    );
  }
}
