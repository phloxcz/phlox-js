import { Component, For, If, state } from '@phloxcz/phlox-js';
import { Form, FormView, formatFileSize } from '@phloxcz/phlox-js/forms';

/** A form type of its own, not a generated DTO: that one has no File. */
interface ArticleInput { title: string; cover: File | null; attachments: File[] }

/** Nothing is uploaded: the value is File objects and onSuccess decides what to do with them. */
export default class Uploads extends Component {
  readonly form = new Form<ArticleInput>();
  readonly sent = state<ArticleInput | null>(null);

  constructor() {
    super();
    this.form.addText('title', 'Název').setRequired('Vyplňte název.');
    this.form.addUpload('cover', 'Obrázek')
      .addRule(Form.Image, 'Jen obrázek.')
      .addRule(Form.MaxFileSize, 'Nejvýš 2 MB.', 2 * 1024 * 1024);
    this.form.addMultiUpload('attachments', 'Přílohy')
      .addRule(Form.MaxLength, 'Nejvýš %d soubory.', 3);
    this.form.addSubmit('save', 'Odeslat');
    // Here the files would go to the server: in parts over RPC (fileChunks), or as a body of fetch()
    this.form.onSuccess = values => this.sent.set(values);
  }

  render() {
    return (
      <div>
        <FormView form={this.form} />
        <If when={this.sent}>
          {sent => (
            <ul>
              <li>Obrázek: {() => (sent().cover ? `${sent().cover!.name}, ${formatFileSize(sent().cover!.size)}` : 'žádný')}</li>
              <For each={() => sent().attachments}>{file => <li>Příloha: {file.name}, {formatFileSize(file.size)}</li>}</For>
            </ul>
          )}
        </If>
      </div>
    );
  }
}
