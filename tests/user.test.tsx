import { beforeEach, describe, expect, test } from 'vitest';
import { Container, If, Presenter, RouteFrame } from '../src/index';
import type { Route } from '../src/index';
import { Authenticator, Authorizator, BrowserUserStorage, Identity, Permission, User } from '../src/security/index';
import { boot, tick } from './helpers';

class FakeAuthenticator extends Authenticator {
  async authenticate(username: string, password: string): Promise<Identity> {
    if (password !== 'secret') throw new Error('Wrong password.');
    return new Identity(7, username === 'admin' ? ['admin'] : [], { name: username }, `token-${username}`);
  }
}

const acl = new Permission()
  .addRole('guest')
  .addRole('authenticated', 'guest')
  .addRole('admin', 'authenticated')
  .addResource('task')
  .allow('guest', 'task', 'view')
  .allow('admin', 'task');

const services = () => new Container().add(FakeAuthenticator, acl);

class Root extends Presenter {
  render() {
    return (
      <div>
        <If when={() => this.user.isLoggedIn()}>
          <p id="who">{() => String(this.user.getIdentity()?.data.name)}</p>
        </If>
        <If when={() => this.user.isAllowed('task', 'delete')}>
          <button id="delete">delete</button>
        </If>
      </div>
    );
  }
}

beforeEach(() => sessionStorage.clear());

describe('User', () => {
  test('is a guest until logged in, then has roles of the identity', async () => {
    const { app } = await boot(Root, '/', services());
    const user = app.user;
    expect(user.isLoggedIn()).toBe(false);
    expect(user.getRoles()).toEqual(['guest']);
    expect(user.isAllowed('task', 'view')).toBe(true);
    expect(user.isAllowed('task', 'delete')).toBe(false);

    await user.login('admin', 'secret');
    expect(user.isLoggedIn()).toBe(true);
    expect(user.getId()).toBe(7);
    expect(user.token).toBe('token-admin');
    expect(user.isInRole('admin')).toBe(true);
    expect(user.isAllowed('task', 'delete')).toBe(true);

    user.logout();
    expect(user.getIdentity()).toBeNull();
    expect(user.token).toBeNull();
  });

  test('a logged-in identity without roles has the authenticated role', async () => {
    const { app } = await boot(Root, '/', services());
    await app.user.login('ann', 'secret');
    expect(app.user.getRoles()).toEqual(['authenticated']);
  });

  test('wrong credentials leave the user logged out', async () => {
    const { app } = await boot(Root, '/', services());
    await expect(app.user.login('ann', 'wrong')).rejects.toThrow('Wrong password.');
    expect(app.user.isLoggedIn()).toBe(false);
  });

  test('templates follow login and logout', async () => {
    const { app, element } = await boot(Root, '/', services());
    expect(element.querySelector('#who')).toBeNull();
    expect(element.querySelector('#delete')).toBeNull();
    await app.user.login('admin', 'secret');
    expect(element.querySelector('#who')!.textContent).toBe('admin');
    expect(element.querySelector('#delete')).not.toBeNull();
    app.user.logout();
    expect(element.querySelector('#who')).toBeNull();
  });

  test('the identity survives a reload of the page through sessionStorage', async () => {
    const first = await boot(Root, '/', services());
    await first.app.user.login(new Identity(3, ['admin'], { name: 'Bob' }, 'abc'));
    first.app.stop();

    const second = await boot(Root, '/', services());
    expect(second.app.user.getIdentity()).toEqual(new Identity(3, ['admin'], { name: 'Bob' }, 'abc'));
    second.app.user.logout();
    expect(new BrowserUserStorage().load()).toBeNull();
  });

  test('a broken stored identity is ignored', () => {
    sessionStorage.setItem('phlox.identity', '{not json');
    expect(new BrowserUserStorage().load()).toBeNull();
  });

  test('without an Authenticator or Authorizator in the container the error says what to add', async () => {
    class Plain extends Presenter {
      render() { return <b />; }
    }
    const { app } = await boot(Plain, '/', new Container());
    await expect(app.user.login('a', 'b')).rejects.toThrow('No Authenticator in the container');
    expect(() => app.user.isAllowed('task')).toThrow('No Authorizator in the container');
  });

  test('the Authorizator can be own class, found by its abstract type', async () => {
    class Everything extends Authorizator {
      isAllowed() { return true; }
    }
    const { app } = await boot(Root, '/', new Container().add(Everything));
    expect(app.user.isAllowed('anything', 'at all')).toBe(true);
    expect(app.container.get(User)).toBe(app.user);
  });
});

describe('protected presenters', () => {
  class Secret extends Presenter {
    static actions = 0;
    override startup() {
      if (!this.user.isLoggedIn()) this.redirect('/sign/in');
    }
    actionDefault() { Secret.actions++; }
    render() { return <h1>secret</h1>; }
  }
  class SignIn extends Presenter {
    render() { return <h1>sign in</h1>; }
  }
  class App extends Presenter {
    override routes: Route[] = [
      { name: 'secret', pattern: '/secret', presenter: Secret },
      { name: 'signIn', pattern: '/sign/in', presenter: SignIn },
    ];
    render() { return <RouteFrame />; }
  }

  test('a redirect from startup stops the navigation, the protected screen never appears', async () => {
    Secret.actions = 0;
    const { element, go } = await boot(App, '/sign/in', services());
    await go('/secret');
    await tick();
    expect(location.pathname).toBe('/sign/in');
    expect(element.querySelector('h1')!.textContent).toBe('sign in');
    expect(Secret.actions).toBe(0);
  });

  test('the same on the first load of the page', async () => {
    Secret.actions = 0;
    const { element } = await boot(App, '/secret', services());
    await tick();
    expect(location.pathname).toBe('/sign/in');
    expect(element.querySelector('h1')!.textContent).toBe('sign in');
    expect(Secret.actions).toBe(0);
  });

  test('a logged-in user gets in', async () => {
    const { app, element, go } = await boot(App, '/sign/in', services());
    await app.user.login('ann', 'secret');
    await go('/secret');
    expect(element.querySelector('h1')!.textContent).toBe('secret');
  });
});
