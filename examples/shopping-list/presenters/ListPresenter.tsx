import { Else, For, If, Presenter, computed, state } from 'phlox-js';
import type { Route } from 'phlox-js';
import { t } from '../i18n';
import { ShoppingStore } from '../model/ShoppingStore';
import type { Item } from '../model/ShoppingStore';
import { Confirm } from '../components/Confirm';
import { ItemEdit } from '../components/ItemEdit';

export class ListPresenter extends Presenter {
  items = state<Item[]>([]);
  draft = state('');
  remaining = computed(() => this.items().filter(item => !item.done).length);

  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    {
      // /5 opens the editing dialog over the list
      name: 'edit',
      pattern: '/<id \\d+>',
      dialog: ({ id }) => [ItemEdit, { id: Number(id) }],
      closed: saved => {
        if (!saved) return;
        this.flashMessage(t('edit.saved'), 'success');
        void this.reload();
      },
    },
  ];

  constructor(private store: ShoppingStore) {
    super();
  }

  /** In startup and not in an action, the list must be there after a direct link to the dialog as well. */
  override async startup() {
    await this.reload();
  }

  async reload() {
    this.items.set(await this.store.list());
  }

  async handleAdd(event: Event) {
    event.preventDefault();
    const name = this.draft().trim();
    if (!name) return;
    await this.store.add(name);
    this.draft.set('');
    await this.reload();
  }

  async handleToggle(id: number, done: boolean) {
    await this.store.update(id, { done });
    await this.reload();
  }

  async handleDelete(item: Item) {
    const confirmed = await this.openDialog(Confirm, { question: t('list.confirmDelete', { name: item.name }) });
    if (!confirmed) return;
    await this.store.remove(item.id);
    this.flashMessage(t('list.deleted', { name: item.name }));
    await this.reload();
  }

  render() {
    return (
      <section>
        <form onSubmit={event => this.handleAdd(event)}>
          <input
            type="text"
            placeholder={t('list.placeholder')}
            value={this.draft}
            onInput={event => this.draft.set(event.currentTarget.value)}
          />
          <button disabled={() => !this.draft().trim()}>{t('list.add')}</button>
        </form>

        <If when={() => this.items().length}>
          <ul>
            <For each={this.items} key={item => item.id}>
              {item => (
                <li class={() => (item().done ? 'done' : '')}>
                  <input
                    type="checkbox"
                    checked={() => item().done}
                    onChange={event => this.handleToggle(item().id, event.currentTarget.checked)}
                  />
                  <a href={this.link('edit', { id: item().id })}>{() => item().name}</a>
                  <button onClick={() => this.handleDelete(item())}>{t('list.delete')}</button>
                </li>
              )}
            </For>
          </ul>
          <p id="remaining">{() => t('list.remaining', { count: this.remaining() })}</p>
        <Else />
          <p>{t('list.empty')}</p>
        </If>
      </section>
    );
  }
}
