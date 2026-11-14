import { Presenter, RouteFrame } from 'phlox-js';
import type { Route } from 'phlox-js';
import { Form, FormView } from 'phlox-js/forms';

class EditPresenter extends Presenter {
  readonly form = new Form<{ title: string }>();

  constructor() {
    super();
    this.form.addText('title', 'Název').setRequired('Vyplňte název.');
    this.form.addSubmit('save', 'Uložit');
    this.form.setDefaults({ title: 'Nástěnka' });
    this.form.onSuccess = () => {
      this.flashMessage('Uloženo.');
      this.form.markSaved();
    };
  }

  // Leaving with changes asks first: another link, Back, closing the tab
  override hasUnsavedChanges() {
    return this.form.isChanged();
  }

  render() {
    return <FormView form={this.form} />;
  }
}

class OtherPresenter extends Presenter {
  render() {
    return <p>Jiná stránka.</p>;
  }
}

/** Change the name and click the other link without saving. */
export default class AppPresenter extends Presenter {
  override routes: Route[] = [
    { name: 'other', pattern: '/other', presenter: OtherPresenter },
    { name: 'edit', pattern: '', presenter: EditPresenter },
  ];

  render() {
    return (
      <div>
        <nav>
          <a href={this.link('edit')}>Úprava</a>
          <a href={this.link('other')}>Jinam</a>
        </nav>
        <RouteFrame />
      </div>
    );
  }
}
