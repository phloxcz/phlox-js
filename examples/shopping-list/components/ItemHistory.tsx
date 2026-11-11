import { Button, Else, For, If, Presenter, state } from 'phlox-js';
import type { Route } from 'phlox-js';
import { t } from '../i18n';
import { ShoppingStore } from '../model/ShoppingStore';
import type { Change } from '../model/ShoppingStore';
import { ChangeDetail } from './ChangeDetail';

/** Changes of the name of an item, at /5/history. A change opens the third dialog, at /5/history/1. */
export class ItemHistory extends Presenter<{ id: number }> {
  changes = state<Change[]>([]);

  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    {
      name: 'change',
      pattern: '/<index \\d+>',
      dialog: ({ index }) => [ChangeDetail, { id: this.props.id, index: Number(index) }],
      closed: (restored: string | undefined) => {
        if (!restored) return;
        this.flashMessage(t('change.restored', { name: restored }), 'success');
        void this.load();
      },
    },
  ];

  constructor(private store: ShoppingStore) {
    super();
  }

  override async startup() {
    await this.load();
  }

  async load() {
    this.changes.set(await this.store.changes(this.props.id));
  }

  override title() {
    return t('history.title');
  }

  override actions() {
    return <Button onClick={() => this.close()}>{t('common.close')}</Button>;
  }

  render() {
    return (
      <If when={() => this.changes().length}>
        <ol class="history">
          <For each={this.changes}>
            {(change, index) => (
              <li>
                <a href={this.link('change', { index: index() })}>
                  {change.from === null
                    ? t('history.created', { name: change.to })
                    : t('history.renamed', { from: change.from, to: change.to })}
                </a>
              </li>
            )}
          </For>
        </ol>
      <Else />
        <p>{t('history.empty')}</p>
      </If>
    );
  }
}
