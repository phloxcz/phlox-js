import { For, Presenter, motion, setMotion } from 'phlox-js';
import type { Motion } from 'phlox-js';
import { Form, FormView } from 'phlox-js/forms';
import { HelpdeskApi } from '../api';
import type { ProfileInput } from '../api';
import { Store } from '../model/Store';

const MOTIONS: [Motion, string][] = [['system', 'Podle systému'], ['on', 'Zapnuté'], ['off', 'Vypnuté']];

/** The profile of the user and the animations at /settings. Leaving with an unsaved profile asks first. */
export default class SettingsPresenter extends Presenter {
  form = new Form<ProfileInput>();

  constructor(private api: HelpdeskApi, private store: Store) {
    super();
    this.form.addText('name', 'Jméno').setRequired('Vyplňte jméno.');
    this.form.addText('title', 'Pozice');
    this.form.addSubmit('save', 'Uložit profil');
    this.form.onSuccess = async input => {
      await this.api.call('user.updateProfile', { input });
      await this.store.load();
      this.flashMessage('Profil je uložený.', 'success');
    };
  }

  override startup() {
    const me = this.store.user(Number(this.user.getId()));
    if (me) this.form.setDefaults({ name: me.name, title: me.title });
  }

  override hasUnsavedChanges() {
    return this.form.isChanged();
  }

  render() {
    return (
      <section class="hd-column hd-page" aria-labelledby="hd-settings-title">
        <h1 id="hd-settings-title">Nastavení</h1>
        <div class="hd-card">
          <h2>Profil</h2>
          <FormView form={this.form} class="hd-dialog-form" />
        </div>
        <div class="hd-card">
          <h2>Vzhled</h2>
          <label class="form-label" for="hd-motion">Animace</label>
          {/* Written by hand, not a control of a form: the class of Bootstrap must be given here */}
          <select id="hd-motion" class="form-select" onChange={event => setMotion(event.currentTarget.value as Motion)}>
              <For each={() => MOTIONS}>{([value, text]) => <option value={value} selected={() => motion() === value}>{text}</option>}</For>
          </select>
        </div>
      </section>
    );
  }
}
