import { Component, Dropdown, Else, For, If, computed, state } from 'phlox-js';
import { HelpdeskApi } from '../api';
import type { NotificationResource } from '../api';
import { ago } from '../format';
import { Icon } from './Icon';

/** The bell in the header: unread notifications, a click on one opens its task and marks it read. */
export class Notifications extends Component {
  readonly items = state<NotificationResource[]>([]);
  readonly unread = computed(() => this.items().filter(item => !item.read).length);

  constructor(private api: HelpdeskApi) {
    super();
  }

  override async startup() {
    await this.load();
  }

  async load(): Promise<void> {
    this.items.set(await this.api.call('notification.list'));
  }

  async handleRead(ids: number[]): Promise<void> {
    if (!ids.length) return;
    this.items.update(items => items.map(item => (ids.includes(item.id) ? { ...item, read: true } : item)));
    await this.api.call('notification.markRead', { ids });
  }

  render() {
    return (
      <Dropdown
        class="hd-icon-button hd-bell"
        panelClass="hd-menu hd-notifications"
        placement="bottom-right"
        title="Upozornění"
        onOpen={() => void this.load()}
        label={<>
          <Icon name="bell" size={21} />
          <If when={() => this.unread() > 0}><span class="hd-bell-count">{this.unread}</span></If>
        </>}
      >
        <div class="hd-menu-head">
          <strong>Upozornění</strong>
          <button type="button" class="hd-link" disabled={() => this.unread() === 0}
            onClick={() => this.handleRead(this.items().filter(item => !item.read).map(item => item.id))}>
            Označit vše jako přečtené
          </button>
        </div>
        <If when={() => this.items().length > 0}>
          <For each={this.items} key={item => item.id}>
            {item => (
              <a href={this.link(`/projects/${item().projectId}/${item().taskId}`)} class={() => `hd-notification ${item().read ? '' : 'hd-unread'}`}
                onClick={() => void this.handleRead([item().id])}>
                <span>{() => item().text}</span>
                <small>{() => ago(item().created)}</small>
              </a>
            )}
          </For>
        <Else />
          <p class="hd-muted">Žádná upozornění.</p>
        </If>
      </Dropdown>
    );
  }
}
