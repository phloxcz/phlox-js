import { Component, Dropdown } from 'phlox-js';
import { Store } from '../model/Store';
import { Icon } from './Icon';
import { Avatar } from './ui';

/** The avatar in the header with the menu of the user. */
export class UserMenu extends Component {
  constructor(private store: Store) {
    super();
  }

  handleSignOut(): void {
    this.user.logout();
    void this.app.router.navigate(this.link('/sign'));
  }

  render() {
    const me = () => this.store.user(Number(this.user.getId()));
    return (
      <Dropdown class="hd-user-button" panelClass="hd-menu" placement="bottom-right" title="Uživatel"
        label={<>{() => <Avatar user={me()} size="large" />}<Icon name="chevronDown" size={18} /></>}>
        <div class="hd-menu-head hd-menu-user">
          {() => <Avatar user={me()} size="large" />}
          <span><strong>{() => me()?.name}</strong><small>{() => me()?.email}</small></span>
        </div>
        <a href={this.link('/settings')} class="hd-menu-item"><Icon name="user" size={17} /> Profil a nastavení</a>
        <button type="button" class="hd-menu-item" onClick={() => this.handleSignOut()}><Icon name="logOut" size={17} /> Odhlásit se</button>
      </Dropdown>
    );
  }
}
