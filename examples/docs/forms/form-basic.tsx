import { Button, Component, If, state } from '@phloxcz/phlox-js';
import { Form, FormView } from '@phloxcz/phlox-js/forms';

/** The values of the form, like a DTO generated from PHP. */
interface CreateTask {
  name: string;
  priority: number | null;
  dueDate: string | null;
}

/** A form like Nette\Forms: controls, rules, onSuccess with typed values, setDefaults and isChanged. */
export default class TaskForm extends Component {
  readonly form = new Form<CreateTask>();
  readonly saved = state<CreateTask | null>(null);

  constructor() {
    super();
    this.form.addText('name', 'Název')
      .setRequired('Vyplňte název.')
      .addRule(Form.MaxLength, 'Nejvýš %d znaků.', 40);
    this.form.addSelect('priority', 'Priorita', { 1: 'Nízká', 2: 'Střední', 3: 'Vysoká' })
      .setPrompt('Vyberte');
    this.form.addDate('dueDate', 'Termín');
    this.form.addSubmit('save', 'Uložit');
    this.form.onSuccess = async values => {
      await new Promise(resolve => setTimeout(resolve, 500));   // the buttons are disabled meanwhile
      this.saved.set(values);
    };
  }

  render() {
    return (
      <div>
        <FormView form={this.form} />
        <p>
          <Button small onClick={() => this.form.setDefaults({ name: 'Ze serveru', priority: 2, dueDate: '2026-12-01' })}>setDefaults()</Button>{' '}
          Změněno: <strong>{() => (this.form.isChanged() ? 'ano' : 'ne')}</strong>
        </p>
        <If when={this.saved}>
          {saved => <pre>onSuccess: {() => JSON.stringify(saved(), null, 1)}</pre>}
        </If>
      </div>
    );
  }
}
