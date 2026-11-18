import { Presenter, state } from '@phloxcz/phlox-js';
import type { Container, Params, Route } from '@phloxcz/phlox-js';
import { Tree, TreeView } from '@phloxcz/phlox-js/components';
import { CategoryStore } from './_categories';
import type { CategoryNode } from './_categories';

export function services(container: Container) {
  container.add(CategoryStore);
}

/**
 * A tree loaded level by level, its selection follows the URL (/11), nodes are moved by dragging and saved
 * on the server; the server refuses to move "Výprodej" and the node goes back.
 */
export default class CategoriesPresenter extends Presenter {
  public override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'detail', pattern: '/<id:int>' },
  ];

  public readonly name = state('');
  public readonly tree: Tree<CategoryNode>;

  public constructor(private store: CategoryStore) {
    super();
    this.tree = new Tree<CategoryNode>({
      load: parent => this.store.children(parent?.id ?? null),
      path: id => this.store.path(id),
      remember: 'docs-categories',
      draggable: node => !node.disabled,
      move: ({ node, parent, index }) => this.store.move(node.id, parent?.id ?? null, index),
    });
  }

  public override async startup() {
    await this.tree.load();
  }

  public async actionDefault() {
    this.name.set('');
    await this.tree.select(null);
  }

  // Also Back and Forward come here: the tree selects the node from the URL and opens the way to it
  public async actionDetail({ id }: Params) {
    await this.tree.select(Number(id));
    this.name.set(this.store.name(Number(id)));
  }

  public render() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <TreeView tree={this.tree} lines aria-label="Kategorie" href={node => this.link('detail', { id: node.id })}
          icon={node => (node.locked ? '🔒' : '📁')} />
        <div>
          <p>{() => (this.name() ? `Kategorie: ${this.name()}` : 'Vyberte kategorii.')}</p>
          <p><a href={this.link('detail', { id: 11 })}>Odkaz na Nože</a> (hluboko v líném stromu)</p>
          <p><small>Uzly jde přetáhnout před jiný, za něj nebo dovnitř, prstem po podržení.</small></p>
        </div>
      </div>
    );
  }
}
