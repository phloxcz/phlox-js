import { If, Else, Presenter, state } from 'phlox-js';
import type { Params, Route } from 'phlox-js';
import { Tree, TreeView } from 'phlox-js/components';
import { Form, FormView } from 'phlox-js/forms';
import type { DropDownTreeSelect, TreeSelect } from 'phlox-js/forms';
import { CategoryStore } from '../model/CategoryStore';
import type { Category, CategoryNode } from '../model/CategoryStore';
import { AppearanceSwitch } from '../../shared/appearance';

interface CategoryInput {
  name: string;
  parentId: number | null;
  alsoIn: number[];
}

/**
 * Categories of a shop: the tree on the left, the selected category on the right.
 * The selection follows the URL (/5), nodes are loaded level by level and can be moved by dragging.
 */
export class CategoriesPresenter extends Presenter {
  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'detail', pattern: '/<id \\d+>' },
  ];

  readonly category = state<Category | null>(null);
  readonly tree: Tree<CategoryNode>;
  readonly form = new Form<CategoryInput>();
  private readonly parentSelect: DropDownTreeSelect<number>;
  private readonly alsoInSelect: TreeSelect<number, number[]>;

  constructor(private store: CategoryStore) {
    super();
    this.tree = new Tree<CategoryNode>({
      load: parent => this.store.children(parent?.id ?? null),
      path: id => this.store.path(id),
      remember: 'categories',
      draggable: true,
      // Saved on the server; when it refuses, the node goes back and the error is shown
      move: async ({ node, parent, index }) => {
        await this.store.move(node.id, parent?.id ?? null, index);
        // The pickers in the form are other trees, they show the new order too
        await this.reloadPickers();
      },
    });

    this.form.addText('name', 'Název:').setRequired('Vyplňte název.');
    // A drop-down: closed it shows the way to the parent, open the tree
    this.parentSelect = this.form.addDropDownTreeSelect('parentId', 'Nadřazená kategorie:', {
      load: parent => this.store.children(parent?.id ?? null),
      path: id => this.store.path(id),
      lines: true,
      placeholder: 'Žádná, horní úroveň',
    });
    this.parentSelect.addRule(control => control.getValue() !== this.category()?.id, 'Kategorie nemůže být sama sobě nadřazená.');
    // The tree right in the form, several nodes
    this.alsoInSelect = this.form.addTreeMultiSelect('alsoIn', 'Zobrazit také v:', {
      load: parent => this.store.children(parent?.id ?? null),
      path: id => this.store.path(id),
      lines: true,
    });
    this.form.addSubmit('save', 'Uložit');
    this.form.onSuccess = values => this.handleSave(values);
  }

  /** The tree is there for every route, also after a direct link to a category. */
  override async startup() {
    await this.tree.load();
  }

  async actionDefault() {
    this.category.set(null);
    await this.tree.select(null);
  }

  /** Also Back and Forward come here: the tree selects the node from the URL and opens the way to it. */
  async actionDetail({ id }: Params) {
    const category = await this.store.get(Number(id));
    if (!category) this.error(404, `Kategorie ${id} neexistuje.`);
    this.category.set(category);
    this.form.setDefaults({ name: category.name, parentId: category.parentId, alsoIn: category.alsoIn });
    await this.tree.select(category.id);
  }

  async handleSave(values: CategoryInput) {
    const id = this.category()!.id;
    await this.store.update(id, values);
    this.flashMessage('Kategorie je uložená.', 'success');
    await Promise.all([this.tree.reload(), this.reloadPickers()]);
    await this.actionDetail({ id: String(id) });
  }

  private async reloadPickers() {
    await Promise.all([this.parentSelect.tree.reload(), this.alsoInSelect.tree.reload()]);
  }

  render() {
    return (
      <div class="layout">
        <aside>
          <h1>Kategorie</h1>
          <TreeView
            tree={this.tree}
            lines
            aria-label="Kategorie"
            href={node => this.link('detail', { id: node.id })}
            icon={(node, item) => (node.locked ? '🔒' : () => (item.hasChildren() ? '📁' : '📄'))}
          />
          <p class="hint">Uzly jde přetáhnout před jiný, za něj nebo doprostřed do něj, prstem po podržení. „Výprodej“ server přesunout nedovolí.</p>
          <AppearanceSwitch />
        </aside>

        <main>
          <If when={this.category}>
            {/* The value of a control is reactive: the heading follows typing, before anything is saved */}
            <h2>{this.form.get('name').value}</h2>
            <p>{() => `Produktů: ${this.category()?.products ?? 0}`}</p>
            <FormView form={this.form} />
            <Else />
            <p class="hint">Vyberte kategorii ve stromu.</p>
          </If>
        </main>
      </div>
    );
  }
}
