import { Component } from '@phloxcz/phlox-js';
import { Form, FormTag, Input, Label } from '@phloxcz/phlox-js/forms';

interface Columns { left: string; right: string }

/**
 * Editors in narrow columns, as high as their text: the toolbar floats over the page only while the editor has the
 * focus, above the editor on the left (held at the top of the window while it is scrolled), above the caret on the right.
 */
export default class FloatingToolbarDemo extends Component {
  public readonly form = new Form<Columns>();

  public constructor() {
    super();
    const toolbar = 'format,align,lists,link,emoji';
    this.form.addEditor('left', 'Lišta nad editorem', { floatingToolbar: 'top', autoHeight: true, toolbar });
    this.form.addEditor('right', 'Lišta u kurzoru', { floatingToolbar: 'caret', autoHeight: true, toolbar });
    const lines = Array.from({ length: 8 }, (_, index) => `<p>Řádek ${index + 1}: klikněte sem a lišta bude nad ním.</p>`).join('');
    this.form.setDefaults({ left: '<p>Klikněte sem a pište, editor poroste s textem.</p>', right: lines });
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
