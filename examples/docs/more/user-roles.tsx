import { Button, If, Presenter, RouteFrame } from '@phloxcz/phlox-js';
import type { Container, Route } from '@phloxcz/phlox-js';
import { Identity, Permission } from '@phloxcz/phlox-js/security';

export function services(container: Container) {
  container.add(new Permission()
    .addRole('guest')
    .addRole('authenticated', 'guest')
    .addRole('admin', 'authenticated')
    .addResource('task')
    .allow('guest', 'task', 'view')
    .allow('authenticated', 'task', ['add', 'edit'])
    .allow('admin'));
}

/** Checked in startup() like in Nette: the protected screen does not appear even for a moment. */
class AdminPresenter extends Presenter {
  override startup() {
    if (!this.user.isLoggedIn()) return this.redirect('/');
    if (!this.user.isInRole('admin')) this.error(403, 'Jen pro správce.');
  }

  render() {
    return <p>Administrace, jen pro správce.</p>;
  }
}

class TasksPresenter extends Presenter {
  render() {
    const can = (privilege: string) => () => this.user.isAllowed('task', privilege);
    return (
      <ul>
        <li>Prohlížet: {() => (can('view')() ? 'ano' : 'ne')}</li>
        <li>Přidat: {() => (can('add')() ? 'ano' : 'ne')}</li>
        <li>Smazat: {() => (can('delete')() ? 'ano' : 'ne')}</li>
        <If when={can('delete')}><li><Button danger small>Smazat úkol</Button></li></If>
      </ul>
    );
  }
}

/** Sign in as somebody: the templates follow, because the methods of User read state. */
export default class AppPresenter extends Presenter {
  override routes: Route[] = [
    { name: 'admin', pattern: '/admin', presenter: AdminPresenter },
    { name: 'tasks', pattern: '', presenter: TasksPresenter },
  ];

  async signIn(roles: string[]) {
    await this.user.login(new Identity(1, roles, { name: roles[0] ?? 'uživatel' }));
    this.redirect('this');
  }

  render() {
    return (
      <div>
        <p style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', alignItems: 'center' }}>
          <Button small onClick={() => this.signIn([])}>Přihlásit (bez rolí)</Button>
          <Button small onClick={() => this.signIn(['admin'])}>Přihlásit jako admin</Button>
          <Button small onClick={() => { this.user.logout(); this.redirect('/'); }}>Odhlásit</Button>
          <span>{() => (this.user.isLoggedIn() ? `Přihlášen: ${this.user.getIdentity()?.data.name}` : 'Nepřihlášen (guest)')}</span>
        </p>
        <nav>
          <a href={this.link('tasks')}>Úkoly</a>
          <a href={this.link('admin')}>Administrace</a>
        </nav>
        <RouteFrame />
      </div>
    );
  }
}
