import { Component, If } from '@phloxcz/phlox-js';
import { Tree, TreeView } from '@phloxcz/phlox-js/components';
import type { TreeNode } from '@phloxcz/phlox-js/components';

/** All nodes at once, with icons; the selection is a state, selected by a click, Enter or the arrows. */
export default class StaticTree extends Component {
  public readonly tree = new Tree<TreeNode<string>>({
    nodes: [
      { id: 'src', label: 'src', children: [
        { id: 'src/ui', label: 'ui', children: [{ id: 'src/ui/dom.ts', label: 'dom.ts' }, { id: 'src/ui/flow.ts', label: 'flow.ts' }] },
        { id: 'src/forms', label: 'forms', children: [{ id: 'src/forms/form.ts', label: 'form.ts' }] },
        { id: 'src/index.ts', label: 'index.ts' },
      ] },
      { id: 'tests', label: 'tests', children: [{ id: 'tests/router.test.tsx', label: 'router.test.tsx' }] },
      { id: 'package.json', label: 'package.json' },
      { id: 'secret', label: 'tajné (disabled)', disabled: true },
    ],
  });

  public render() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <TreeView tree={this.tree} lines aria-label="Soubory"
          icon={(_, item) => () => (item.hasChildren() ? (item.expanded() ? '📂' : '📁') : '📄')} />
        <If when={this.tree.selected}>
          {id => <p>Vybráno: <code>{id}</code></p>}
        </If>
      </div>
    );
  }
}
