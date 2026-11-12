import { Button, Component } from 'phlox-js';
import { FormView, Form } from 'phlox-js/forms';
import { HelpdeskApi } from '../api';
import type { SupportInput } from '../api';

/** A message to the support in a dialog. The server checks the length of the message, the error shows at the field. */
export class SupportContact extends Component<{}, boolean> {
  form = new Form<SupportInput>();

  constructor(private api: HelpdeskApi) {
    super();
    this.form.addText('subject', 'Předmět').setRequired('Vyplňte předmět.');
    this.form.addTextArea('message', 'Zpráva');
    this.form.onSuccess = async input => {
      await this.api.call('support.contact', { input });
      this.close(true);
    };
  }

  override hasUnsavedChanges() {
    return this.form.isChanged();
  }

  override title() {
    return 'Kontaktovat podporu';
  }

  override actions() {
    return <>
      <Button onClick={() => this.cancel()}>Zrušit</Button>
      <Button primary disabled={this.form.submitting} onClick={() => this.form.submit()}>Odeslat</Button>
    </>;
  }

  render() {
    return <FormView form={this.form} class="hd-dialog-form" />;
  }
}
