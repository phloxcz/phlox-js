import { Button, Else, For, If, Presenter, computed, state } from 'phlox-js';
import type { Route } from 'phlox-js';
import { Form, FormTag, Input, InputError } from 'phlox-js/forms';
import { t } from '../i18n';
import { ShoppingStore } from '../model/ShoppingStore';
import { CATEGORIES } from '../model/ShoppingStore';
import type { Item } from '../model/ShoppingStore';
import { ItemEdit } from '../components/ItemEdit';

export class ListPresenter extends Presenter {
  items = state<Item[]>([]);
  remaining = computed(() => this.items().filter(item => !item.done).length);
  addForm = new Form<{ name: string; category: number | null }>();

  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    {
      // /5 opens the editing dialog over the list, /5/history and /5/history/1 the next ones over it
      name: 'edit',
      pattern: '/<id \\d+>',
      dialog: ({ id }) => [ItemEdit, { id: Number(id) }],
      closed: saved => {
        if (saved) this.flashMessage(t('edit.saved'), 'success');
        // Also without saving, a name could have been restored in the history
        void this.reload();
      },
    },
  ];

  constructor(private store: ShoppingStore) {
    super();
    this.addForm.addText('name').setRequired(t('list.required'));
    // Fixed items, filtered in the browser
    this.addForm.addDropDownList('category', '', { items: CATEGORIES, placeholder: t('list.category') });
    this.addForm.addSubmit('add', t('list.add'));
    this.addForm.onSuccess = values => this.handleAdd(values.name, values.category);
  }

  /** In startup and not in an action, the list must be there after a direct link to the dialog as well. */
  override async startup() {
    await this.reload();
  }

  async reload() {
    this.items.set(await this.store.list());
  }

  async handleAdd(name: string, category: number | null) {
    await this.store.add(name.trim(), category);
    this.addForm.reset();
    await this.reload();
  }

  async handleToggle(id: number, done: boolean) {
    await this.store.update(id, { done });
    await this.reload();
  }

  /** Asks by a popover at the button; without `anchor` it would be a dialog. */
  async handleDelete(item: Item, button: HTMLElement) {
    const confirmed = await this.confirm(t('list.confirmDelete', { name: item.name }), { anchor: button, danger: true, okText: t('list.delete') });
    if (!confirmed) return;
    await this.store.remove(item.id);
    this.flashMessage(t('list.deleted', { name: item.name }));
    await this.reload();
  }

  render() {
    return (
      <section>
        <FormTag form={this.addForm} class="add">
          <Input control={this.addForm.get('name')} placeholder={t('list.placeholder')} />
          <Input control={this.addForm.get('category')} />
          <Input control={this.addForm.getButton('add')} />
        </FormTag>
        <InputError control={this.addForm.get('name')} />

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
                  <span class="category">
                    {() => [CATEGORIES.find(([id]) => id === item().category)?.[1], item().shop, ...item().labels].filter(Boolean).join(' · ')}
                  </span>
                  <Button danger small onClick={event => this.handleDelete(item(), event.currentTarget)}>{t('list.delete')}</Button>
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
