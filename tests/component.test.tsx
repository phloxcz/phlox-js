import { describe, expect, test } from 'vitest';
import { Component, Container, If, Presenter, render, state } from '../src/index';
import type { Child } from '../src/index';
import { boot, deferred, tick } from './helpers';

class Clock {
  now = '12:00';
}

/** Shows the given component inside a running application. */
function host(view: () => Child) {
  return class Host extends Presenter {
    render() {
      return <div>{view()}</div>;
    }
  };
}

describe('Component', () => {
  test('life cycle: startup, render, afterRender, shutdown', async () => {
    const log: string[] = [];
    const show = state(true);
    class Box extends Component {
      override startup() { log.push('startup'); }
      render() { log.push('render'); return <b>box</b>; }
      override afterRender() { log.push(`afterRender ${document.body.contains(document.querySelector('b'))}`); }
      override shutdown() { log.push('shutdown'); }
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
      text = `Hello ${this.props.name}`;
      render() { return <p>{this.text}{this.props.children}</p>; }
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
      constructor(private clock: Clock) { super(); }
      render() { return <time>{this.clock.now}</time>; }
    }
    const { element } = await boot(host(() => <Time />), '/', new Container().add(Clock));
    expect(element.textContent).toBe('12:00');
  });

  test('the view of a component with async startup appears when the data is loaded', async () => {
    const loaded = deferred();
    class Slow extends Component {
      text = state('');
      override async startup() {
        await loaded.promise;
        this.text.set('loaded');
      }
      render() { return <b>{this.text}</b>; }
    }
    const { element } = await boot(host(() => <Slow />));
    expect(element.querySelector('b')).toBeNull();
    loaded.resolve();
    await tick();
    expect(element.textContent).toBe('loaded');
  });

  test('a failing async startup is reported and shows nothing', async () => {
    class Broken extends Component {
      override async startup() { throw new Error('no data'); }
      render() { return <b>never</b>; }
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
      render() { renders++; return <b>{count() > 100 ? 'big' : 'small'}{count}</b>; }
    }
    const { element } = await boot(host(() => <Counter />));
    count.set(1);
    expect(renders).toBe(1);
    expect(element.textContent).toBe('small1');
  });

  test('ref gives the instance and parent points to the owner', async () => {
    let box: Box | undefined;
    class Box extends Component {
      render() { return <b />; }
    }
    const Host = host(() => <Box ref={component => { box = component; }} />);
    await boot(Host);
    expect(box).toBeInstanceOf(Box);
    expect(box!.parent).toBeInstanceOf(Host);
  });

  test('a component cannot be created by hand or used without an application', () => {
    class Box extends Component {
      render() { return <b />; }
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
      field = effect(() => void runs.push(`field ${source()}`));
      constructor() {
        super();
        effect(() => void runs.push(`constructor ${source()}`));
      }
      override startup() {
        effect(() => void runs.push(`startup ${source()}`));
      }
      render() { return <i />; }
    }
    const shown = state(true);
    class Page extends Presenter {
      render() { return <If when={shown}><Watcher /></If>; }
    }
    await boot(Page);
    source.set(1);
    expect(runs.splice(0)).toEqual(['field 0', 'constructor 0', 'startup 0', 'field 1', 'constructor 1', 'startup 1']);
    shown.set(false);
    source.set(2);
    expect(runs).toEqual([]);
  });
});
