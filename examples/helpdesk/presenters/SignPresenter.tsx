import { Button, For, Presenter } from 'phlox-js';
import { Form, FormErrors, FormTag, Input, InputError, Label } from 'phlox-js/forms';
import { RpcError } from 'phlox-js/net';
import { Logo } from '../components/Icon';

interface SignIn {
  email: string;
  password: string;
}

const ACCOUNTS = ['lucie@helpdesk.cz', 'jan@helpdesk.cz', 'petra@helpdesk.cz'];

/** Sign-in at /sign. The identity with the token is kept by User, see services.ts. */
export class SignPresenter extends Presenter {
  form = new Form<SignIn>();

  constructor() {
    super();
    this.form.addEmail('email', 'E-mail').setRequired('Vyplňte e-mail.');
    this.form.addPassword('password', 'Heslo').setRequired('Vyplňte heslo.');
    this.form.addSubmit('send', 'Přihlásit se');
    this.form.onSuccess = values => this.handleSignIn(values);
  }

  override pageTitle() {
    return 'Přihlášení';
  }

  override startup() {
    if (this.user.isLoggedIn()) this.redirect('/projects');
  }

  async handleSignIn({ email, password }: SignIn): Promise<void> {
    try {
      await this.user.login(email, password);
    } catch (error) {
      // A wrong password is an error of the form, not of the application
      if (!(error instanceof RpcError)) throw error;
      this.form.addError(error.message);
      return;
    }
    // Another user may have been signed in before: their data must not stay
    this.app.invalidate('users', 'projects', 'tasks');
    this.redirect('/projects');
  }

  render() {
    const email = this.form.get('email');
    const password = this.form.get('password');
    return (
      <div class="hd-sign">
        <FormTag form={this.form} class="hd-sign-card">
          <div class="hd-brand"><Logo /> HelpDesk Pro</div>
          <h1>Přihlášení</h1>
          <FormErrors form={this.form} />
          <div class="hd-field">
            <Label control={email} />
            <Input control={email} autocomplete="username" />
            <InputError control={email} />
          </div>
          <div class="hd-field">
            <Label control={password} />
            <Input control={password} autocomplete="current-password" />
            <InputError control={password} />
          </div>
          <Input control={this.form.getButton('send')} class="btn btn-primary hd-button-block" />
          <p class="hd-sign-hint">
            Ukázkové účty, heslo <code>demo</code>:
            <For each={() => ACCOUNTS}>
              {account => (
                <Button small class="hd-sign-account" onClick={() => this.form.setValues({ email: account, password: 'demo' })}>
                  {account}
                </Button>
              )}
            </For>
          </p>
        </FormTag>
      </div>
    );
  }
}
