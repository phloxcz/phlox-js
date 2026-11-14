import { Component, computed } from 'phlox-js';
import type { Container } from 'phlox-js';
import { Form, FormView } from 'phlox-js/forms';
import { CategoryStore } from '../data/_categories';

interface Values { parentId: number | null; shownIn: number[]; moveTo: number | null }

export function services(container: Container) {
  container.add(CategoryStore);
}

/** A tree in the form: one node, several nodes, and one node in a drop-down panel; all loaded by levels. */
export default class TreeSelects extends Component {
  readonly form = new Form<Values>();
  readonly values = computed(() => JSON.stringify(this.form.getValues()));

  constructor(private categories: CategoryStore) {
    super();
    const nodes = {
      load: (parent: { id: number } | null) => this.categories.children(parent?.id ?? null),
      path: (id: number) => this.categories.path(id),
    };
    this.form.addTreeSelect('parentId', 'Nadřazená kategorie', { ...nodes, lines: true }).setRequired('Vyberte kategorii.');
    this.form.addTreeMultiSelect('shownIn', 'Zobrazit také v', nodes);
    this.form.addDropDownTreeSelect('moveTo', 'Přesunout do', { ...nodes, placeholder: 'Horní úroveň' });
    // A value deep in the lazy tree: path() opens the way to it
    this.form.setDefaults({ parentId: 11, moveTo: 6 });
  }

  render() {
    return <div><FormView form={this.form} /><p><code>{this.values}</code></p></div>;
  }
}
