import { BadRequestError, Component, state } from 'phlox-js';
import { t } from '../i18n';
import { ShoppingStore } from '../model/ShoppingStore';

/** Edits one item. It returns true when the item was saved. */
export class ItemEdit extends Component<{ id: number }, boolean> {
  name = state('');

  constructor(private store: ShoppingStore) {
    super();
  }

  override async startup() {
    const item = await this.store.get(this.props.id);
    if (!item) throw new BadRequestError(404, t('edit.missing', { id: String(this.props.id) }));
    this.name.set(item.name);
  }

  override title() {
    return t('edit.title');
  }

  override actions() {
    return (
      <>
        <button onClick={() => this.close(false)}>{t('common.cancel')}</button>
        <button disabled={() => !this.name().trim()} onClick={() => this.handleSave()}>{t('common.save')}</button>
      </>
    );
  }

  async handleSave() {
    await this.store.update(this.props.id, { name: this.name().trim() });
    this.close(true);
  }

  render() {
    return (
      <label>
        {t('edit.name')}{' '}
        <input type="text" value={this.name} onInput={event => this.name.set(event.currentTarget.value)} />
      </label>
    );
  }
}
