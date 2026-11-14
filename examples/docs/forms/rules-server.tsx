import { Component } from '@phloxcz/phlox-js';
import { Form, FormView } from '@phloxcz/phlox-js/forms';
import { RpcError, RpcErrorCode } from '@phloxcz/phlox-js/net';

interface Customer { name: string; email: string }

/** Errors from the server (invalid params of phlox-rpc-api) are shown at the fields, not thrown. */
export default class ServerErrors extends Component {
  readonly form = new Form<Customer>();

  constructor() {
    super();
    this.form.addText('name', 'Jméno').setRequired('Vyplňte jméno.');
    this.form.addEmail('email', 'E-mail');
    this.form.addSubmit('save', 'Uložit');
    this.form.onSuccess = async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      // What phlox-rpc-api answers: input.<field> → the control <field>; an unknown path → an error of the form
      throw new RpcError(RpcErrorCode.InvalidParams, 'Invalid params', {
        fields: { 'input.email': 'Tento e-mail už je registrovaný.', 'input.vip': 'Zákazník nemůže být VIP.' },
      });
    };
  }

  render() {
    return <FormView form={this.form} />;
  }
}
