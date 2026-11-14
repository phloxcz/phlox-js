import { Component, Dropdown, DropdownItem, For, state } from '@phloxcz/phlox-js';

/** A menu and a panel with a filter; the content is made at every opening, onOpen loads data. */
export default class Dropdowns extends Component {
  readonly picked = state('nic');
  readonly opened = state(0);
  readonly onlyMine = state(false);

  render() {
    return (
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Dropdown label="Akce" title="Akce s položkou">
          <For each={() => ['Upravit', 'Kopírovat', 'Smazat']}>
            {action => <DropdownItem active={() => this.picked() === action} onClick={() => this.picked.set(action)}>{action}</DropdownItem>}
          </For>
        </Dropdown>
        <Dropdown label="Filtr" placement="bottom-right" onOpen={() => this.opened.update(n => n + 1)}>
          <div style={{ padding: '.5rem .75rem' }}>
            {/* A checkbox keeps the panel open */}
            <label><input type="checkbox" checked={this.onlyMine} onChange={event => this.onlyMine.set(event.currentTarget.checked)} /> Jen moje</label>
          </div>
        </Dropdown>
        <span>Vybráno: {this.picked}, filtr otevřen {this.opened}×, jen moje: {() => String(this.onlyMine())}</span>
      </div>
    );
  }
}
