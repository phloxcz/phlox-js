import { describe, expect, test, vi } from 'vitest';
import { Application, BadRequestError, Container, Presenter, RouteFrame, state } from '../src/index';
import type { Params, Route } from '../src/index';
import { boot, deferred, tick, until, goBack } from './helpers';

const log: string[] = [];
const take = () => log.splice(0);

class Home extends Presenter {
  render() { return <h1>home</h1>; }
}

class UserDetail extends Presenter {
  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'orders', pattern: '/orders' },
    { name: 'order', pattern: '/orders/<year \\d+>/<number>' },
  ];
  override startup() { log.push('detail startup'); }
  override shutdown() { log.push('detail shutdown'); }
  actionOrders(params: Params) { log.push(`orders ${JSON.stringify(params)}`); }
  actionOrder(params: Params) { log.push(`order ${params.year}/${params.number}`); }
  render() { return <h2>detail of {() => (this.parent as Users).params().id} {this.route}</h2>; }
}

class Users extends Presenter {
  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'detail', pattern: '/<id \\d+>', presenter: UserDetail },
  ];
  override startup() { log.push('users startup'); }
  override shutdown() { log.push('users shutdown'); }
  actionDefault(params: Params) { log.push(`users default ${JSON.stringify(params)}`); }
  actionDetail(params: Params) { log.push(`users detail ${JSON.stringify(params)}`); }
  render() { return <section><h1>users</h1><RouteFrame /></section>; }
}

class App extends Presenter {
  override routes: Route[] = [
    { name: 'home', pattern: '/', presenter: Home },
    { name: 'users', pattern: '/users', presenter: Users },
    { name: 'lazy', pattern: '/lazy', presenter: async () => ({ default: Home }) },
  ];
  render() {
    return (
      <div>
        <nav>
          <a id="users" href={this.link('users')}>users</a>
          <a id="external" href="https://example.com/">out</a>
        </nav>
        <RouteFrame />
      </div>
    );
  }
}

describe('nested routing', () => {
  test('URL is split among presenters and their views are nested', async () => {
    take();
    const { element, go } = await boot(App, '/users/15/orders/2026/A-7');
    expect(element.querySelector('h1')!.textContent).toBe('users');
    expect(element.querySelector('h2')!.textContent).toBe('detail of 15 order');
    expect(take()).toEqual(['users startup', 'users detail {"id":"15"}', 'detail startup', 'order 2026/A-7']);

    await go('/');
    expect(element.querySelector('h1')!.textContent).toBe('home');
    expect(take()).toEqual(['detail shutdown', 'users shutdown']);
  });

  test('a presenter stays while only what is below it changes', async () => {
    const { go } = await boot(App, '/users/15');
    take();
    await go('/users/15/orders');
    expect(take()).toEqual(['orders {}']);
  });

  test('a change of parameters above creates the presenter below again', async () => {
    const { element, go } = await boot(App, '/users/15/orders');
    take();
    await go('/users/16/orders');
    expect(take()).toEqual(['users detail {"id":"16"}', 'detail startup', 'orders {}', 'detail shutdown']);
    expect(element.querySelector('h2')!.textContent).toBe('detail of 16 orders');
  });

  test('a trailing slash makes no difference', async () => {
    const { element } = await boot(App, '/users/');
    expect(element.querySelector('h1')!.textContent).toBe('users');
  });

  test('a presenter is loaded lazily', async () => {
    const { element } = await boot(App, '/lazy');
    expect(element.querySelector('h1')!.textContent).toBe('home');
  });
});

describe('regressions from TraceJS', () => {
  test('a route with two parameters matches', async () => {
    take();
    await boot(App, '/users/1/orders/2026/7');
    expect(take()).toContain('order 2026/7');
  });

  test('a parameter with the value 0 is not missing', async () => {
    take();
    const { app } = await boot(App, '/users/0');
    expect(take()).toContain('users detail {"id":"0"}');
    expect(app.presenter!.link('/x', { page: 0, empty: '', off: false })).toBe('/x?page=0&empty=&off=false');
  });

  test('a query value may contain =', async () => {
    take();
    await boot(App, '/users?filter=a=b&x=1');
    expect(take()).toContain('users default {"filter":"a=b","x":"1"}');
  });

  test('query cannot pollute Object.prototype', async () => {
    await boot(App, '/users?__proto__[polluted]=1&__proto__=2&constructor[prototype][polluted]=3');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false);
  });

  test('an unknown URL does not crash, also below a presenter with a child', async () => {
    const { element, errors, go } = await boot(App, '/users/15');
    await go('/users/15/nothing/here');
    expect(errors[0]).toBeInstanceOf(BadRequestError);
    expect((errors[0] as BadRequestError).code).toBe(404);
    expect(element.querySelector('h1')!.textContent).toBe('users');

    await go('/nowhere');
    expect(errors).toHaveLength(2);
    await go('/');
    expect(element.querySelector('h1')!.textContent).toBe('home');
  });

  test('a slower older navigation cannot overwrite a newer one', async () => {
    const slow = deferred();
    class Slow extends Presenter {
      override async startup() { await slow.promise; }
      render() { return <h1>slow</h1>; }
    }
    class Root extends Presenter {
      override routes: Route[] = [
        { name: 'home', pattern: '/', presenter: Home },
        { name: 'slow', pattern: '/slow', presenter: Slow },
        { name: 'fast', pattern: '/fast', presenter: Users },
      ];
      render() { return <RouteFrame />; }
    }
    const { element, go } = await boot(Root);
    const first = go('/slow');
    const second = go('/fast');
    slow.resolve();
    await Promise.all([first, second]);
    expect(element.querySelector('h1')!.textContent).toBe('users');
    expect(location.pathname).toBe('/fast');
  });
});

describe('query', () => {
  test('goes to the presenter at the end and runs its action again when it changes', async () => {
    const { go } = await boot(App, '/users/15/orders?page=1');
    take();
    await go('/users/15/orders?page=2');
    expect(take()).toEqual(['orders {"page":"2"}']);
  });

  test('a route parameter wins over a query parameter of the same name', async () => {
    take();
    await boot(App, '/users/15/orders/2026/7?year=1999');
    expect(take()).toContain('order 2026/7');
  });
});

describe('links', () => {
  test('link() to a route, to this page and to an absolute path', async () => {
    const { app, go } = await boot(App, '/users/15/orders?page=2');
    const users = app.presenter!.child() as Users;
    const detail = users.child() as UserDetail;

    expect(users.link('detail', { id: 7 })).toBe('/users/7');
    expect(users.link('detail', { id: 7, tab: 'a b' })).toBe('/users/7?tab=a+b');
    expect(users.link('default')).toBe('/users');
    expect(detail.link('order', { year: 2026, number: 'A/7' })).toBe('/users/15/orders/2026/A%2F7');
    expect(detail.link('this', { page: 3 })).toBe('/users/15/orders?page=3');
    expect(detail.link('this', { page: null, sort: 'name' })).toBe('/users/15/orders?sort=name');
    expect(detail.link('/about', { x: 1 })).toBe('/about?x=1');
    expect(() => users.link('detail')).toThrow("Missing parameter 'id'");
    expect(() => users.link('nothing')).toThrow("Users has no route 'nothing'");

    await go(detail.link('order', { year: 2026, number: 'A/7' }));
    expect(detail.params().number).toBe('A/7');
  });

  test('persistent parameters stay in links of the presenter and of those below it', async () => {
    const { app, go } = await boot(App, '/users/15/orders?page=2&sort=name&filter.state=open&tab=x');
    const users = app.presenter!.child() as Users;
    const detail = users.child() as UserDetail;
    users.persistent = ['page', 'filter.*'];
    detail.persistent = ['sort'];

    expect(users.link('detail', { id: 7 })).toBe('/users/7?page=2&filter.state=open');
    expect(users.link('detail', { id: 7, page: 1 })).toBe('/users/7?page=1&filter.state=open');
    expect(users.link('detail', { id: 7, page: null })).toBe('/users/7?filter.state=open');
    // The presenter below keeps its own and those of the presenters above
    expect(detail.link('orders')).toBe('/users/15/orders?page=2&sort=name&filter.state=open');
    // Not to an absolute path, which leaves the presenter
    expect(users.link('/about')).toBe('/about');

    await go('/users/15');
    expect(users.link('detail', { id: 7 })).toBe('/users/7');
  });

  test('a click on a link navigates without a reload, other clicks are left to the browser', async () => {
    const { element } = await boot(App);
    const link = element.querySelector('#users')!;
    const click = (target: Element, ctrlKey = false) =>
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey }));

    // Runs after the listener of the application: records what it did and stops jsdom from leaving the page
    const handled: boolean[] = [];
    const watcher = (event: Event): void => {
      handled.push(event.defaultPrevented);
      event.preventDefault();
    };
    document.addEventListener('click', watcher);
    click(link, true);
    click(element.querySelector('#external')!);
    click(link);
    document.removeEventListener('click', watcher);

    expect(handled).toEqual([false, false, true]);
    await tick();
    expect(location.pathname).toBe('/users');
    expect(element.querySelector('h1')!.textContent).toBe('users');
  });

  test('the Back button returns to the previous screen', async () => {
    const { element, go } = await boot(App);
    await go('/users');
    await goBack();
    expect(element.querySelector('h1')!.textContent).toBe('home');
  });
});

describe('redirect, errors and the old screen', () => {
  test('redirect in an action leads to the target and leaves one history entry', async () => {
    class Root extends Presenter {
      override routes: Route[] = [
        { name: 'home', pattern: '/', presenter: Home },
        { name: 'old', pattern: '/old' },
        { name: 'users', pattern: '/users', presenter: Users },
      ];
      actionOld() { return this.redirect('users'); }
      render() { return <RouteFrame />; }
    }
    const { element, go } = await boot(Root);
    await go('/old');
    await until(() => location.pathname === '/users');
    expect(element.querySelector('h1')!.textContent).toBe('users');

    // /old never got into history, so one step back is the page before it
    history.back();
    await until(() => location.pathname === '/');
  });

  test("redirect('this') runs the action again", async () => {
    let loads = 0;
    class Root extends Presenter {
      override routes: Route[] = [{ name: 'default', pattern: '/' }];
      actionDefault() { loads++; }
      handleDelete() { this.redirect('this'); }
      render() { return <b />; }
    }
    const { app, go } = await boot(Root);
    expect(loads).toBe(1);
    await go('/');
    expect(loads).toBe(1);
    (app.presenter as Root).handleDelete();
    await tick();
    expect(loads).toBe(2);
  });

  test('the old screen stays until the new one is ready, and when the new one fails', async () => {
    const data = deferred<boolean>();
    class Slow extends Presenter {
      override async startup() {
        if (!(await data.promise)) this.error(500, 'no data');
      }
      render() { return <h1>slow</h1>; }
    }
    class Root extends Presenter {
      override routes: Route[] = [
        { name: 'home', pattern: '/', presenter: Home },
        { name: 'slow', pattern: '/slow', presenter: Slow },
      ];
      render() { return <RouteFrame />; }
    }
    const { element, errors, go } = await boot(Root);
    const navigation = go('/slow');
    await tick();
    expect(element.querySelector('h1')!.textContent).toBe('home');
    data.resolve(false);
    await navigation;
    expect(element.querySelector('h1')!.textContent).toBe('home');
    expect(location.pathname).toBe('/');
    expect((errors[0] as BadRequestError).code).toBe(500);
  });

  test('notFound() can be overridden', async () => {
    class Root extends Presenter {
      missing = state('');
      override routes: Route[] = [{ name: 'home', pattern: '/', presenter: Home }];
      override notFound(path: string) { this.missing.set(path); }
      render() { return <div><RouteFrame /><p>{this.missing}</p></div>; }
    }
    const { element, errors } = await boot(Root, '/nothing');
    expect(errors).toEqual([]);
    expect(element.querySelector('p')!.textContent).toBe('/nothing');
    expect(element.querySelector('h1')).toBeNull();
  });

  test('flashMessage adds a message to the application', async () => {
    const { app } = await boot(App);
    app.presenter!.flashMessage('Saved', 'success');
    expect(app.flashes.messages()).toEqual([{ text: 'Saved', type: 'success', duration: 5000 }]);
    app.flashes.remove(app.flashes.messages()[0]!);
    expect(app.flashes.messages()).toEqual([]);
  });
});

describe('base path', () => {
  test('the application under /admin: routes, links, clicks and pages outside it', async () => {
    history.replaceState(null, '', '/admin/users/15');
    const element = document.createElement('main');
    document.body.append(element);
    const app = new Application(new Container());
    app.basePath = '/admin/';
    app.onError = error => { throw error; };
    await app.run(App, element);
    try {
      expect(element.querySelector('h2')!.textContent).toBe('detail of 15 default');
      expect(app.presenter!.link('users')).toBe('/admin/users');
      expect(app.presenter!.link('/about')).toBe('/admin/about');
      expect(element.querySelector<HTMLAnchorElement>('#users')!.getAttribute('href')).toBe('/admin/users');

      await app.router.navigate('/admin');
      expect(element.querySelector('h1')!.textContent).toBe('home');
      expect(location.pathname).toBe('/admin');

      // A link inside the base path is a navigation, a link outside it is left to the browser
      const navigate = vi.spyOn(app.router, 'navigate');
      const click = (href: string) => {
        const link = Object.assign(document.createElement('a'), { href });
        document.body.append(link);
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      };
      // jsdom cannot load another page
      const stay = (event: Event) => event.preventDefault();
      document.addEventListener('click', stay);
      click('/admin/users');
      click('/shop');
      document.removeEventListener('click', stay);
      expect(navigate.mock.calls.map(call => call[0])).toEqual(['/admin/users']);
      await tick();
      expect(location.pathname).toBe('/admin/users');
    } finally {
      app.stop();
    }
  });
});

describe('presenters in the middle of the chain', () => {
  test('props from the parameters of the route, persistent parameters in params', async () => {
    const seen: string[] = [];
    class Task extends Presenter<{ taskId: number }> {
      override startup() { seen.push(`task ${this.props.taskId} at ${this.basePath()}`); }
      render() { return <b>{this.props.taskId}</b>; }
    }
    class Tasks extends Presenter<{ projectId: number }> {
      override persistent = ['status'];
      override routes: Route[] = [
        { name: 'default', pattern: '/' },
        { name: 'detail', pattern: '/<task \\d+>', presenter: Task, props: ({ task }) => ({ taskId: Number(task) }) },
      ];
      override startup() { seen.push(`project ${this.props.projectId} ${this.params().status}`); }
      actionDetail(params: Params) { seen.push(`status ${params.status ?? '-'}`); }
      render() { return <div><RouteFrame /></div>; }
    }
    class Root extends Presenter {
      override routes: Route[] = [
        { name: 'project', pattern: '/<project \\d+>', presenter: Tasks, props: ({ project }) => ({ projectId: Number(project) }) },
      ];
      render() { return <main><RouteFrame /></main>; }
    }
    const { app, element, go, errors } = await boot(Root, '/3/7?status=open&other=1');
    expect(errors).toEqual([]);
    // startup() knows the parameters and the part of the URL, like in Nette
    expect(seen.splice(0)).toEqual(['project 3 open', 'status open', 'task 7 at /3/7']);
    const tasks = app.presenter!.child()! as Tasks;
    expect(tasks.params()).toEqual({ status: 'open', task: '7' });
    expect(element.querySelector('b')!.textContent).toBe('7');

    // A change of the persistent parameter runs the action, the child stays
    await go('/3/7?status=closed');
    expect(seen.splice(0)).toEqual(['status closed']);
    await go('/3/8?status=closed');
    expect(seen.splice(0)).toEqual(['status closed', 'task 8 at /3/8']);
  });
});
