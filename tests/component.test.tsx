import { describe, expect, test } from 'vitest';
import { Component, Container, If, Presenter, render, state } from '../src/index';
import type { Child } from '../src/index';
import { boot, deferred, tick } from './helpers';

class Clock {
  public now = '12:00';
}

/** Shows the given component inside a running application. */
function host(view: () => Child) {
  return class Host extends Presenter {
    public render() {
      return <div>{view()}</div>;
    }
  };
}

describe('Component', () => {
  test('flashMessage() in a component, as in a presenter', async () => {
    class Saver extends Component {
      public override startup() {
        this.flashMessage('Uloženo.', 'success', { title: 'Hotovo' });
      }
      public render() {
        return <p>ok</p>;
      }
    }
    const { app } = await boot(host(() => <Saver />));
    expect(app.flashes.messages().map(flash => [flash.text, flash.type, flash.title])).toEqual([['Uloženo.', 'success', 'Hotovo']]);
  });

  test('life cycle: startup, render, afterRender, shutdown', async () => {
    const log: string[] = [];
    const show = state(true);
    class Box extends Component {
      public override startup() { log.push('startup'); }
      public render() { log.push('render'); return <b>box</b>; }
      public override afterRender() { log.push(`afterRender ${document.body.contains(document.querySelector('b'))}`); }
      public override shutdown() { log.push('shutdown'); }
    }
    const { element } = await boot(host(() => <If when={show}><Box /></If>));
    expect(element.textContent).toBe('box');
    await tick();
    expect(log).toEqual(['startup', 'render', 'afterRender true']);

    show.set(false);
    expect(log.at(-1)).toBe('shutdown');
    expect(element.textContent).toBe('');
  });

  test('props are checked, ready in field initializers and children are passed', async () => {
    class Greeting extends Component<{ name: string; children?: Child }> {
      public text = `Hello ${this.props.name}`;
      public render() { return <p>{this.text}{this.props.children}</p>; }
    }
    const { element } = await boot(host(() => <Greeting name="Ann"><i>!</i></Greeting>));
    expect(element.querySelector('p')!.textContent).toBe('Hello Ann!');

    // @ts-expect-error a missing prop
    void (<Greeting />);
    // @ts-expect-error a wrong type of a prop
    void (<Greeting name={1} />);
  });

  test('services in the constructor are autowired', async () => {
    class Time extends Component {
      public constructor(private clock: Clock) { super(); }
      public render() { return <time>{this.clock.now}</time>; }
    }
    const { element } = await boot(host(() => <Time />), '/', new Container().add(Clock));
    expect(element.textContent).toBe('12:00');
  });

  test('the view of a component with async startup appears when the data is loaded', async () => {
    const loaded = deferred();
    class Slow extends Component {
      public text = state('');
      public override async startup() {
        await loaded.promise;
        this.text.set('loaded');
      }
      public render() { return <b>{this.text}</b>; }
    }
    const { element } = await boot(host(() => <Slow />));
    expect(element.querySelector('b')).toBeNull();
    loaded.resolve();
    await tick();
    expect(element.textContent).toBe('loaded');
  });

  test('a failing async startup is reported and shows nothing', async () => {
    class Broken extends Component {
      public override async startup() { throw new Error('no data'); }
      public render() { return <b>never</b>; }
    }
    const { element, errors } = await boot(host(() => <Broken />));
    await tick();
    expect(element.textContent).toBe('');
    expect(String(errors[0])).toContain('no data');
  });

  test('state read in render() does not render the component again', async () => {
    const count = state(0);
    let renders = 0;
    class Counter extends Component {
      public render() { renders++; return <b>{count() > 100 ? 'big' : 'small'}{count}</b>; }
    }
    const { element } = await boot(host(() => <Counter />));
    count.set(1);
    expect(renders).toBe(1);
    expect(element.textContent).toBe('small1');
  });

  test('ref gives the instance and parent points to the owner', async () => {
    let box: Box | undefined;
    class Box extends Component {
      public render() { return <b />; }
    }
    const Host = host(() => <Box ref={component => { box = component; }} />);
    await boot(Host);
    expect(box).toBeInstanceOf(Box);
    expect(box!.parent).toBeInstanceOf(Host);
  });

  test('a component cannot be created by hand or used without an application', () => {
    class Box extends Component {
      public render() { return <b />; }
    }
    expect(() => new Box()).toThrow('must be created by the framework');
    expect(() => render(() => <Box />, document.body)).toThrow('only inside a running Application');
  });
});

describe('effects of a component', () => {
  test('effects made in a field, in the constructor and in startup() end with the component', async () => {
    const { effect } = await import('../src/index');
    const source = state(0);
    const runs: string[] = [];
    class Watcher extends Component {
      public field = effect(() => void runs.push(`field ${source()}`));
      public constructor() {
        super();
        effect(() => void runs.push(`constructor ${source()}`));
      }
      public override startup() {
        effect(() => void runs.push(`startup ${source()}`));
      }
      public render() { return <i />; }
    }
    const shown = state(true);
    class Page extends Presenter {
      public render() { return <If when={shown}><Watcher /></If>; }
    }
    await boot(Page);
    source.set(1);
    expect(runs.splice(0)).toEqual(['field 0', 'constructor 0', 'startup 0', 'field 1', 'constructor 1', 'startup 1']);
    shown.set(false);
    source.set(2);
    expect(runs).toEqual([]);
  });
});

describe('errors of event handlers', () => {
  test('a thrown error and a rejected promise of a handler go to app.onError', async () => {
    class Page extends Presenter {
      public async handleSave() {
        await Promise.resolve();
        throw new Error('server is down');
      }
      public render() {
        return <p>
          <button id="async" onClick={() => this.handleSave()}>Uložit</button>
          <button id="sync" onClick={() => { throw new Error('broken'); }}>Rozbité</button>
        </p>;
      }
    }
    const { element, errors } = await boot(Page);
    element.querySelector<HTMLButtonElement>('#async')!.click();
    element.querySelector<HTMLButtonElement>('#sync')!.click();
    await tick();
    expect(errors.map(String)).toEqual(['Error: broken', 'Error: server is down']);
  });
});

describe('all errors of the application in app.onError', () => {
  test('with their source: an event handler, navigation, and what the browser reports on window', async () => {
    class Page extends Presenter {
      public override routes = [{ name: 'default', pattern: '/' }, { name: 'broken', pattern: '/broken' }];
      public actionBroken() {
        throw new Error('no such page');
      }
      public render() {
        return <button onClick={() => { throw new Error('broken'); }}>Rozbité</button>;
      }
    }
    const { app, element } = await boot(Page);
    const seen: string[] = [];
    app.onError = (error, source) => seen.push(`${source}: ${String(error)}`);

    element.querySelector('button')!.click();
    await app.router.navigate('/broken');
    const thrown = new ErrorEvent('error', { error: new Error('in a timer'), message: 'in a timer', cancelable: true });
    window.dispatchEvent(thrown);
    const rejected = Object.assign(new Event('unhandledrejection', { cancelable: true }), { reason: new Error('nobody awaits') });
    window.dispatchEvent(rejected);
    // The noise of ResizeObserver is no error of the application
    window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.', cancelable: true }));
    await tick();

    expect(seen).toEqual([
      'event: Error: broken',
      'navigation: Error: no such page',
      'global: Error: in a timer',
      'global: Error: nobody awaits',
    ]);
    // The browser does not print them again
    expect(thrown.defaultPrevented).toBe(true);
    expect(rejected.defaultPrevented).toBe(true);
  });

  test('a failing onError does not report itself; after stop() window errors are not the application\'s', async () => {
    const { app } = await boot(class extends Presenter {
      public render() { return <p />; }
    });
    const logged: unknown[] = [];
    const log = console.error;
    console.error = (...args: unknown[]) => logged.push(args);
    let calls = 0;
    app.onError = () => {
      calls++;
      throw new Error('the log is down');
    };
    try {
      window.dispatchEvent(new ErrorEvent('error', { error: new Error('first'), cancelable: true }));
      expect(calls).toBe(1);
      expect(logged).toHaveLength(1);

      app.stop();
      const rejected = Object.assign(new Event('unhandledrejection', { cancelable: true }), { reason: new Error('after stop') });
      window.dispatchEvent(rejected);
      expect(calls).toBe(1);
      expect(rejected.defaultPrevented).toBe(false);
    } finally {
      console.error = log;
    }
  });
});

describe('app.onError called by the application', () => {
  test('the source may be left out', async () => {
    const { app } = await boot(class extends Presenter {
      public render() { return <p />; }
    });
    const seen: unknown[] = [];
    app.onError = (error, source) => seen.push([String(error), source]);
    app.onError(new Error('own'));
    expect(seen).toEqual([['Error: own', undefined]]);
  });
});
