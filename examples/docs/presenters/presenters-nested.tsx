import { For, If, Presenter, RouteFrame, state } from '@phloxcz/phlox-js';
import type { Route } from '@phloxcz/phlox-js';

interface User { id: number; name: string; email: string }

const USERS: User[] = [
  { id: 1, name: 'Jana Nováková', email: 'jana@example.cz' },
  { id: 2, name: 'Petr Svoboda', email: 'petr@example.cz' },
  { id: 3, name: 'Eva Dvořáková', email: 'eva@example.cz' },
];

/** /users/2: the list takes /users, the detail gets /2. */
class UserDetailPresenter extends Presenter<{ userId: number }> {
  public readonly detail = state<User | null>(null);

  public override startup() {
    this.detail.set(USERS.find(user => user.id === this.props.userId) ?? null);
  }

  public render() {
    return (
      <If when={this.detail}>
        {user => <p><strong>{() => user().name}</strong>, {() => user().email}</p>}
      </If>
    );
  }
}

class UsersPresenter extends Presenter {
  public override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'detail', pattern: '/<id:int>', presenter: UserDetailPresenter, props: ({ id }) => ({ userId: Number(id) }) },
  ];

  public render() {
    return (
      <div>
        <h3>Uživatelé</h3>
        <ul>
          <For each={() => USERS}>
            {user => <li><a href={this.link('detail', { id: user.id })}>{user.name}</a></li>}
          </For>
        </ul>
        <RouteFrame />
      </div>
    );
  }
}

class AboutPresenter extends Presenter {
  public render() {
    return <p>Stránka bez dalších rout.</p>;
  }
}

/** The root: a menu and the place for the presenter of the current route. */
export default class AppPresenter extends Presenter {
  public override routes: Route[] = [
    { name: 'users', pattern: '/users', presenter: UsersPresenter },
    { name: 'about', pattern: '/about', presenter: AboutPresenter },
    { name: 'home', pattern: '/' },
  ];

  public actionHome() {
    this.redirect('users');
  }

  public render() {
    return (
      <div>
        <nav>
          <a href={this.link('users')} class={() => (this.route() === 'users' ? 'active' : '')}>Uživatelé</a>
          <a href={this.link('about')} class={() => (this.route() === 'about' ? 'active' : '')}>O aplikaci</a>
        </nav>
        <RouteFrame />
      </div>
    );
  }
}
