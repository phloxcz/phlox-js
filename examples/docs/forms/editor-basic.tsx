import { Component, Html } from 'phlox-js';
import { Form, FormView } from 'phlox-js/forms';

interface Note { text: string }

/** The WYSIWYG editor as a control: its value is HTML, the same in every browser; shown cleaned by <Html>. */
export default class EditorDemo extends Component {
  readonly form = new Form<Note>();

  constructor() {
    super();
    this.form.addEditor('text', 'Poznámka', {
      toolbar: 'format,align,lists,link,image,table,emoji',
      minHeight: 120,
      placeholder: 'Napište poznámku…',
      // No upload here: a pasted or chosen image is inserted as base64
    }).setRequired('Napište poznámku.');
    this.form.setDefaults({ text: '<p>Text může být <strong>tučně</strong> a <em>kurzívou</em>.</p>' });
  }

  render() {
    const text = this.form.get('text');
    return (
      <div>
        <FormView form={this.form} />
        <p><small>Hodnota (HTML):</small></p>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.8rem' }}>{text.value}</pre>
        <p><small>Zobrazená přes &lt;Html&gt;:</small></p>
        <Html html={text.value} />
      </div>
    );
  }
}
