import { BadRequestError, Component, If } from 'phlox-js';
import { t, translator } from '../i18n';
import { ShoppingStore } from '../model/ShoppingStore';
import type { Change } from '../model/ShoppingStore';

/** One change, at /5/history/1. Restoring returns the restored name, closing returns nothing. */
export class ChangeDetail extends Component<{ id: number; index: number }, string> {
  change!: Change;

  constructor(private store: ShoppingStore) {
    super();
  }

  override async startup() {
    const change = (await this.store.changes(this.props.id))[this.props.index];
    if (!change) throw new BadRequestError(404, t('change.missing'));
    this.change = change;
  }

  override title() {
    return t('change.title');
  }

  override actions() {
    return (
      <>
        <button type="button" onClick={() => this.close()}>{t('common.close')}</button>
        <If when={() => this.change.from !== null}>
          <button type="button" onClick={() => this.handleRestore()}>{t('change.restore')}</button>
        </If>
      </>
    );
  }

  async handleRestore() {
    await this.store.update(this.props.id, { name: this.change.from! });
    this.close(this.change.from!);
  }

  render() {
    const when = new Intl.DateTimeFormat(translator.locale, { dateStyle: 'medium', timeStyle: 'medium' });
    return (
      <dl class="change">
        <dt>{t('change.when')}</dt>
        <dd>{when.format(new Date(this.change.at))}</dd>
        <dt>{t('change.from')}</dt>
        <dd>{this.change.from ?? '–'}</dd>
        <dt>{t('change.to')}</dt>
        <dd>{this.change.to}</dd>
      </dl>
    );
  }
}
