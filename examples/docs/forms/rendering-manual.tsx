import { Component } from '@phloxcz/phlox-js';
import { Form, FormErrors, FormTag, Input, InputError, Label } from '@phloxcz/phlox-js/forms';

interface Category { name: string; description: string }

/** Rendered by hand like {form} in Latte; the value of a control elsewhere on the page as a state. */
export default class ManualForm extends Component {
  public readonly form = new Form<Category>();

  public constructor() {
    super();
    this.form.addText('name', 'Název').setRequired('Vyplňte název.').addRule(Form.MaxLength, 'Nejvýš %d znaků.', 40);
    this.form.addTextArea('description', 'Popis');
    this.form.addSubmit('save', 'Uložit');
    this.form.onSuccess = () => this.flashMessage('Uloženo.', 'success');
  }

  public render() {
    const name = this.form.get('name');
    const description = this.form.get('description');
    return (
      <div>
        {/* The value as a state: follows typing, like a binding in MVVM */}
        <h3>{() => name.value() || 'Nová kategorie'}</h3>
        <FormTag form={this.form}>
          <FormErrors form={this.form} />
          <div style={{ display: 'grid', gridTemplateColumns: '8rem 1fr', gap: '.5rem', alignItems: 'start' }}>
            <Label control={name} />
            <div>
              <Input control={name} placeholder="např. Nádobí" />
              <small> {() => `${name.value().length} / 40`}</small>
              <InputError control={name} />
            </div>
            <Label control={description} />
            <Input control={description} rows={3} />
          </div>
          <p><Input control={this.form.getButton('save')} /></p>
        </FormTag>
      </div>
    );
  }
}
