import { describe, expect, test } from 'vitest';
import { Component, Presenter, RouteFrame } from '../src/index';
import type { Route } from '../src/index';
import { boot, deferred, tick, goBack, until } from './helpers';

const windows = () => [...document.querySelectorAll<HTMLElement>('dialog.phlox-dialog')];
const press = (selector: string) => document.querySelector<HTMLElement>(selector)!.click();

class Confirm extends Component<{ question: string }, boolean> {
  override title() { return 'Confirm'; }
  override actions() {
    return (
      <>
        <button id="no" onClick={() => this.close(false)}>No</button>
        <button id="yes" onClick={() => this.close(true)}>Yes</button>
      </>
    );
  }
  render() { return <p>{this.props.question}</p>; }
}

class Edit extends Component<{ id: number }, string> {
  override title() { return `Edit ${this.props.id}`; }
  render() { return <button id="save" onClick={() => this.close('saved')}>save</button>; }
}

class List extends Presenter {
  static results: unknown[] = [];
  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    {
      name: 'edit',
      pattern: '/<id \\d+>',
      dialog: ({ id }) => [Edit, { id: Number(id) }],
      closed: result => { List.results.push(result); },
    },
  ];
  render() { return <h1>list</h1>; }
}

class Home extends Presenter {
  render() { return <h1>home</h1>; }
}

class Root extends Presenter {
  override routes: Route[] = [
    { name: 'home', pattern: '/', presenter: Home },
    { name: 'list', pattern: '/list', presenter: List },
  ];
  render() { return <RouteFrame />; }
}

describe('openDialog', () => {
  test('shows the component in a window and returns what it was closed with', async () => {
    const { app } = await boot(Root);
    const answer = app.presenter!.openDialog(Confirm, { question: 'Sure?' });
    await tick();

    const [dialog] = windows();
    expect(dialog!.querySelector('h2')!.textContent).toBe('Confirm');
    expect(dialog!.querySelector('p')!.textContent).toBe('Sure?');
    expect(dialog!.querySelectorAll('footer button')).toHaveLength(2);

    press('#yes');
    expect(await answer).toBe(true);
    expect(windows()).toHaveLength(0);

    // @ts-expect-error props of the dialog are checked
    void (() => app.presenter!.openDialog(Confirm, {}));
  });

  test('Escape and the close button return undefined', async () => {
    const { app } = await boot(Root);
    const first = app.presenter!.openDialog(Confirm, { question: '?' });
    await tick();
    windows()[0]!.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(await first).toBeUndefined();

    const second = app.presenter!.openDialog(Confirm, { question: '?' });
    await tick();
    press('dialog header button');
    expect(await second).toBeUndefined();
    expect(windows()).toHaveLength(0);
  });

  test('a dialog disappears with the component that opened it', async () => {
    const { app, go } = await boot(Root);
    const answer = app.presenter!.child()!.openDialog(Confirm, { question: '?' });
    await tick();
    expect(windows()).toHaveLength(1);
    await go('/list');
    expect(windows()).toHaveLength(0);
    expect(await answer).toBeUndefined();
  });

  test('a dialog waits for its startup and a failure opens nothing', async () => {
    const data = deferred<boolean>();
    class Loading extends Component<{}, void> {
      override async startup() {
        if (!(await data.promise)) throw new Error('no data');
      }
      render() { return <p>loaded</p>; }
    }
    const { app } = await boot(Root);
    const opened = app.presenter!.openDialog(Loading, {});
    await tick();
    expect(windows()).toHaveLength(0);
    data.resolve(false);
    await expect(opened).rejects.toThrow('no data');
    expect(windows()).toHaveLength(0);
  });
});

describe('dialog of a route', () => {
  test('opens over its presenter, closing goes back and delivers the result', async () => {
    List.results = [];
    const { element, go } = await boot(Root, '/list');
    await go('/list/15');
    expect(element.querySelector('h1')!.textContent).toBe('list');
    expect(windows()[0]!.querySelector('h2')!.textContent).toBe('Edit 15');

    press('#save');
    await until(() => location.pathname === '/list');
    await tick();
    expect(windows()).toHaveLength(0);
    expect(List.results).toEqual(['saved']);
  });

  test('after a direct link, closing replaces the URL instead of going back', async () => {
    List.results = [];
    const { element } = await boot(Root, '/list/15');
    expect(element.querySelector('h1')!.textContent).toBe('list');
    expect(windows()).toHaveLength(1);
    const entries = history.length;

    press('#save');
    await until(() => location.pathname === '/list');
    await tick();
    expect(history.length).toBe(entries);
    expect(windows()).toHaveLength(0);
    expect(List.results).toEqual(['saved']);
  });

  test('the Back button closes it and the result is undefined', async () => {
    List.results = [];
    const { go } = await boot(Root, '/list');
    await go('/list/15');
    await goBack();
    expect(windows()).toHaveLength(0);
    expect(List.results).toEqual([undefined]);
  });

  test('other parameters replace the dialog with a new one', async () => {
    List.results = [];
    const { go } = await boot(Root, '/list/15');
    await go('/list/16');
    expect(windows().map(dialog => dialog.querySelector('h2')!.textContent)).toEqual(['Edit 16']);
    expect(List.results).toEqual([undefined]);
  });

  test('leaving the presenter removes the dialog', async () => {
    const { go } = await boot(Root, '/list/15');
    await go('/');
    expect(windows()).toHaveLength(0);
  });
});

describe('dialogs opened from dialogs, all with URL', () => {
  const log: string[] = [];

  class Change extends Component<{ id: number; index: number }, boolean> {
    override title() { return `Change ${this.props.index}`; }
    render() { return <button id="restore" onClick={() => this.close(true)}>restore</button>; }
  }

  class History extends Presenter<{ id: number }, boolean> {
    override routes: Route[] = [
      { name: 'default', pattern: '/' },
      {
        name: 'change',
        pattern: '/<index \\d+>',
        dialog: ({ index }) => [Change, { id: this.props.id, index: Number(index) }],
        closed: restored => { log.push(`change closed ${restored}`); },
      },
    ];
    override title() { return `History ${this.props.id}`; }
    render() { return <a id="change-link" href={this.link('change', { index: 2 })}>change 2</a>; }
  }

  class Item extends Presenter<{ id: number }, boolean> {
    override routes: Route[] = [
      { name: 'default', pattern: '/' },
      {
        name: 'history',
        pattern: '/history',
        dialog: () => [History, { id: this.props.id }],
        closed: changed => { log.push(`history closed ${changed}`); },
      },
    ];
    override title() { return `Item ${this.props.id}`; }
    render() { return <a id="history-link" href={this.link('history')}>history</a>; }
  }

  class Items extends Presenter {
    override routes: Route[] = [
      { name: 'default', pattern: '/' },
      {
        name: 'item',
        pattern: '/<id \\d+>',
        dialog: ({ id }) => [Item, { id: Number(id) }],
        closed: saved => { log.push(`item closed ${saved}`); },
      },
    ];
    render() { return <h1>items</h1>; }
  }

  class App extends Presenter {
    override routes: Route[] = [{ name: 'items', pattern: '/items', presenter: Items }];
    render() { return <RouteFrame />; }
  }

  const titles = () => windows().map(dialog => dialog.querySelector('h2')!.textContent);

  test('links inside dialogs open the next one, each level adds a part of the URL', async () => {
    log.length = 0;
    const { element, go } = await boot(App, '/items');
    await go('/items/5');
    press('#history-link');
    await tick();
    expect(location.pathname).toBe('/items/5/history');
    press('#change-link');
    await tick();
    expect(location.pathname).toBe('/items/5/history/2');
    expect(titles()).toEqual(['Item 5', 'History 5', 'Change 2']);
    expect(element.querySelector('h1')!.textContent).toBe('items');
  });

  test('closing the top one goes one level back and hands its result to the level below', async () => {
    log.length = 0;
    const { go } = await boot(App, '/items');
    await go('/items/5');
    await go('/items/5/history');
    await go('/items/5/history/2');
    press('#restore');
    await until(() => location.pathname === '/items/5/history');
    await tick();
    expect(titles()).toEqual(['Item 5', 'History 5']);
    expect(log).toEqual(['change closed true']);
  });

  test('the Back button closes them one by one', async () => {
    log.length = 0;
    const { go } = await boot(App, '/items');
    await go('/items/5');
    await go('/items/5/history');
    await go('/items/5/history/2');
    await goBack();
    expect(titles()).toEqual(['Item 5', 'History 5']);
    await goBack();
    expect(titles()).toEqual(['Item 5']);
    await goBack();
    expect(titles()).toEqual([]);
    expect(log).toEqual(['change closed undefined', 'history closed undefined', 'item closed undefined']);
  });

  test('a direct link opens all three, closing then replaces the URL level by level', async () => {
    log.length = 0;
    await boot(App, '/items/5/history/2');
    expect(titles()).toEqual(['Item 5', 'History 5', 'Change 2']);
    const entries = history.length;
    press('#restore');
    await until(() => location.pathname === '/items/5/history');
    await tick();
    expect(titles()).toEqual(['Item 5', 'History 5']);
    expect(history.length).toBe(entries);
  });

  test('going to a lower level closes the dialogs above it, leaving closes all', async () => {
    log.length = 0;
    const { go } = await boot(App, '/items/5/history/2');
    await go('/items/5');
    expect(titles()).toEqual(['Item 5']);
    expect(log).toEqual(['change closed undefined', 'history closed undefined']);
    await go('/items/5/history/3');
    expect(titles()).toEqual(['Item 5', 'History 5', 'Change 3']);
    await go('/items');
    expect(titles()).toEqual([]);
  });
});

describe('leaving a presenter with an open routed dialog', () => {
  test('the closed handler of the dialog still learns about it', async () => {
    List.results = [];
    const { go } = await boot(Root, '/list/15');
    await go('/');
    expect(List.results).toEqual([undefined]);
  });
});
