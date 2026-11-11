import { BadRequestError, Presenter } from 'phlox-js';
import type { Route } from 'phlox-js';
import { Form, FormTag, Input, InputError, Label } from 'phlox-js/forms';
import { t } from '../i18n';
import { LABELS, SHOPS, ShoppingStore } from '../model/ShoppingStore';
import { ItemHistory } from './ItemHistory';

interface ItemInput {
  name: string;
  category: number | null;
  shop: string | null;
  labels: string[];
}

/**
 * Edits one item, at /5. It returns true when the item was saved.
 * It is a presenter, so it has routes of its own: /5/history opens the next dialog over it.
 */
export class ItemEdit extends Presenter<{ id: number }, boolean> {
  form = new Form<ItemInput>();

  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    {
      name: 'history',
      pattern: '/history',
      dialog: () => [ItemHistory, { id: this.props.id }],
      // A name could have been restored in the history, also when it was closed by the Back button
      closed: () => void this.loadName(),
    },
  ];

  constructor(private store: ShoppingStore) {
    super();
    this.form.addText('name', t('edit.name'))
      .setRequired(t('edit.required'))
      .addRule(Form.MaxLength, t('edit.tooLong'), 40);
    // Items searched like on a server, the label of the saved value comes from categoryName()
    this.form.addDropDownList('category', t('edit.category'), {
      search: query => this.store.searchCategories(query),
      label: id => this.store.categoryName(id),
      placeholder: t('list.category'),
    });
    // Suggested shops, or any other the user types
    this.form.addComboBox('shop', t('edit.shop'), {
      items: SHOPS,
      allowCustom: true,
      placeholder: t('edit.shopPlaceholder'),
    });
    // Several labels: suggested ones, or new ones typed by the user
    this.form.addTagInput('labels', t('edit.labels'), {
      items: LABELS,
      allowNew: true,
      maxTags: 5,
      placeholder: t('edit.labelsPlaceholder'),
    });
    this.form.onSuccess = values => this.handleSave(values);
  }

  override async startup() {
    await this.loadName();
  }

  async loadName() {
    const item = await this.store.get(this.props.id);
    if (!item) throw new BadRequestError(404, t('edit.missing', { id: String(this.props.id) }));
    this.form.setDefaults({ name: item.name, category: item.category, shop: item.shop, labels: item.labels });
  }

  override title() {
    return t('edit.title');
  }

  /** The buttons are in the footer of the dialog, outside the <form>, so Save sends the form from code. */
  override actions() {
    return (
      <>
        <button type="button" onClick={() => this.close(false)}>{t('common.cancel')}</button>
        <button type="button" disabled={() => this.form.submitting()} onClick={() => this.form.submit()}>
          {t('common.save')}
        </button>
      </>
    );
  }

  async handleSave(values: ItemInput) {
    await this.store.update(this.props.id, { name: values.name.trim(), category: values.category, shop: values.shop, labels: values.labels });
    this.close(true);
  }

  render() {
    const name = this.form.get('name');
    const category = this.form.get('category');
    const shop = this.form.get('shop');
    const labels = this.form.get('labels');
    return (
      <div>
        <FormTag form={this.form}>
          <p><Label control={name} /> <Input control={name} /> <InputError control={name} /></p>
          <p><Label control={category} /> <Input control={category} /></p>
          <p><Label control={shop} /> <Input control={shop} /></p>
          <p><Label control={labels} /> <Input control={labels} /></p>
        </FormTag>
        <p><a href={this.link('history')}>{t('edit.history')}</a></p>
      </div>
    );
  }
}
