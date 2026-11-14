import { Component, state } from '@phloxcz/phlox-js';
import { Form, FormView } from '@phloxcz/phlox-js/forms';

interface SignUp {
  login: string;
  zip: string;
  password: string;
  again: string;
  company: boolean;
  ico: string;
}

/** Rules, a rule with an argument from another control, a condition with toggle(), an own rule. */
export default class SignUpForm extends Component {
  readonly form = new Form<SignUp>();
  readonly result = state('');

  constructor() {
    super();
    const f = this.form;
    f.addText('login', 'Přihlašovací jméno')
      .setRequired('Vyplňte jméno.')
      .addRule(control => control.getValue() !== 'admin', 'Jméno admin je vyhrazené.');
    f.addText('zip', 'PSČ (nepovinné)').addRule(Form.Pattern, 'PSČ má pět číslic.', '\\d{5}');
    const password = f.addPassword('password', 'Heslo').setRequired('Zvolte heslo.').addRule(Form.MinLength, 'Aspoň %d znaků.', 8);
    f.addPassword('again', 'Heslo znovu').addRule(Form.Equal, 'Hesla se neshodují.', password);
    // The IČO row is shown only for a company, and only then required
    f.addCheckbox('company', 'Registruji firmu').addCondition(Form.Filled).toggle(`${f.idPrefix}-ico-pair`);
    f.addText('ico', 'IČO')
      .addConditionOn(f.get('company'), Form.Filled)
        .setRequired('Vyplňte IČO.')
        .addRule(Form.Pattern, 'IČO má osm číslic.', '\\d{8}')
      .endCondition();
    f.addSubmit('send', 'Registrovat');
    f.onSuccess = values => this.result.set(`Prošlo: ${values.login}`);
  }

  render() {
    return <div><FormView form={this.form} /><p>{this.result}</p></div>;
  }
}
