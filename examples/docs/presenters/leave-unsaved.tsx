import { Presenter, RouteFrame } from '@phloxcz/phlox-js';
import type { Route } from '@phloxcz/phlox-js';
import { Form, FormView } from '@phloxcz/phlox-js/forms';

class EditPresenter extends Presenter {
  public readonly form = new Form<{ title: string }>();

  public constructor() {
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
  public override hasUnsavedChanges() {
    return this.form.isChanged();
  }

  public render() {
    return <FormView form={this.form} />;
  }
}

class OtherPresenter extends Presenter {
  public render() {
    return <p>Jiná stránka.</p>;
  }
}

/** Change the name and click the other link without saving. */
export default class AppPresenter extends Presenter {
  public override routes: Route[] = [
    { name: 'other', pattern: '/other', presenter: OtherPresenter },
    { name: 'edit', pattern: '', presenter: EditPresenter },
  ];

  public render() {
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
