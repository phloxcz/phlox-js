import { Component, Dropdown, For, If } from 'phlox-js';
import type { Child } from 'phlox-js';
import { online } from 'phlox-js/net';
import type { OfflineChange } from 'phlox-js/net';
import { OfflineWork } from '../model/offline';
import { ago } from '../format';
import { Icon } from './Icon';

/**
 * In the header: "Offline" without a network, and the changes waiting to be sent, refused by the server,
 * or waiting for a decision because their record changed meanwhile.
 */
export class OfflineStatus extends Component {
  constructor(private work: OfflineWork) {
    super();
  }

  render() {
    const offline = this.work.offline;
    const waiting = () => offline.pending().length + offline.conflicts().length + offline.failed().length;
    const list = (title: string, changes: () => OfflineChange[], actions?: (change: OfflineChange) => Child) => (
      <If when={() => changes().length > 0}>
        <div class="hd-menu-head"><strong>{title}</strong></div>
        <For each={changes} key={change => change.key}>
          {change => (
            <div class="hd-offline-change">
              <span>{() => change().title}<small>{() => change().error ?? ago(change().made)}</small></span>
              {actions ? actions(change()) : null}
            </div>
          )}
        </For>
      </If>
    );
    return (
      <span class="hd-offline">
        <If when={() => !online()}>
          <span class="hd-offline-badge" role="status"><Icon name="wifiOff" size={16} /> Offline</span>
        </If>
        <If when={() => waiting() > 0}>
          <Dropdown class="hd-offline-button" panelClass="hd-menu hd-offline-menu" placement="bottom-right" title="Čekající změny"
            label={<><Icon name="upload" size={17} /><span>{() => (offline.syncing() ? 'Odesílám…' : `${waiting()} ${waiting() === 1 ? 'změna' : waiting() < 5 ? 'změny' : 'změn'}`)}</span></>}>
            {list('Čekají na odeslání', offline.pending)}
            {list('Záznam se mezitím změnil', offline.conflicts, change => <>
              <button type="button" class="hd-link" onClick={() => void offline.resolve(change, 'send')}>Uložit i tak</button>
              <button type="button" class="hd-link" onClick={() => void offline.resolve(change, 'drop')}>Zahodit</button>
            </>)}
            {list('Server odmítl', offline.failed, change => <>
              <button type="button" class="hd-link" onClick={() => void offline.retry(change)}>Znovu</button>
              <button type="button" class="hd-link" onClick={() => void offline.drop(change)}>Zahodit</button>
            </>)}
            <div class="hd-menu-head">
              <button type="button" class="btn btn-primary btn-sm" disabled={() => !online() || offline.syncing() || !offline.pending().length}
                onClick={() => void offline.sync()}>Odeslat teď</button>
            </div>
          </Dropdown>
        </If>
      </span>
    );
  }
}
