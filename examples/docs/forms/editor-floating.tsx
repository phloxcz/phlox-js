import { Component } from '@phloxcz/phlox-js';
import { Form, FormTag, Input, Label } from '@phloxcz/phlox-js/forms';

interface Columns { left: string; right: string }

/** Editors in narrow columns: the toolbar floats over the page only while the editor has the focus. */
export default class FloatingToolbarDemo extends Component {
  public readonly form = new Form<Columns>();

  public constructor() {
    super();
    const options = { floatingToolbar: true, minHeight: 90, toolbar: 'format,align,lists,link,emoji' };
    this.form.addEditor('left', 'Levý sloupec', options);
    this.form.addEditor('right', 'Pravý sloupec', options);
    this.form.setDefaults({ left: '<p>Klikněte sem, lišta se ukáže nad editorem.</p>', right: '<p>Tady také.</p>' });
  }

  public render() {
    const column = (name: keyof Columns) => (
      <div>
        <Label control={this.form.get(name)} />
        <Input control={this.form.get(name)} />
      </div>
    );
    // Room above for the toolbar of an editor at the top of the demo
    return (
      <FormTag form={this.form} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 15rem))', gap: '1rem', paddingTop: '5rem' }}>
        {column('left')}
        {column('right')}
      </FormTag>
    );
  }
}
