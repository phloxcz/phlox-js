import { describe, expect, test } from 'vitest';
import { Component, If, Presenter, state } from '../src/index';
import type { Resource } from '../src/index';
import { boot, deferred, tick } from './helpers';

describe('Component.resource', () => {
  test('loads, loads again when the state it read changes, keeps the value meanwhile', async () => {
    const tab = state('open');
    const calls: string[] = [];
    let tasks!: Resource<string[]>;
    class Page extends Presenter {
      override async startup() {
        tasks = this.resource(async () => {
          calls.push(tab());
          return [`${tab()} 1`, `${tab()} 2`];
        });
        await tasks.ready();
      }
      render() { return <p>{() => tasks()?.join(', ')}</p>; }
    }
    const { element } = await boot(Page);
    expect(element.textContent).toBe('open 1, open 2');

    tab.set('closed');
    expect(tasks.loading()).toBe(true);
    expect(tasks()).toEqual(['open 1', 'open 2']);
    await tasks.ready();
    expect(tasks.loading()).toBe(false);
    expect(element.textContent).toBe('closed 1, closed 2');

    await tasks.reload();
    expect(calls).toEqual(['open', 'closed', 'closed']);
  });

  test('an older answer never overwrites a newer one', async () => {
    const text = state('a');
    const answers = new Map<string, ReturnType<typeof deferred<string>>>();
    let found!: Resource<string>;
    class Search extends Presenter {
      constructor() {
        super();
        found = this.resource(() => {
          const answer = deferred<string>();
          answers.set(text(), answer);
          return answer.promise;
        });
      }
      render() { return <p>{() => found() ?? ''}</p>; }
    }
    const { element } = await boot(Search);
    text.set('ab');
    answers.get('ab')!.resolve('newer');
    await tick();
    answers.get('a')!.resolve('older');
    await tick();
    expect(element.textContent).toBe('newer');
  });

  test('a failure goes to app.onError, the last value stays; nothing loads after the component is gone', async () => {
    const id = state(1);
    const shown = state(true);
    let loads = 0;
    let detail!: Resource<string>;
    class Detail extends Component {
      constructor() {
        super();
        detail = this.resource(async () => {
          loads++;
          if (id() === 2) throw new Error('not found');
          return `task ${id()}`;
        });
      }
      render() { return <b>{() => detail()}</b>; }
    }
    class Page extends Presenter {
      render() { return <If when={shown}><Detail /></If>; }
    }
    const { element, errors } = await boot(Page);
    await detail.ready();
    id.set(2);
    await detail.ready();
    expect(errors.map(String)).toEqual(['Error: not found']);
    expect(element.textContent).toBe('task 1');
    expect(detail.loading()).toBe(false);

    shown.set(false);
    const before = loads;
    id.set(3);
    expect(loads).toBe(before);
  });
});

describe('tags of data and app.invalidate', () => {
  test('invalidate() loads again every resource with the tag, in any component, at once', async () => {
    const calls: string[] = [];
    const load = (name: string) => async () => {
      calls.push(name);
      return name;
    };
    class List extends Component {
      tasks = this.resource(load('list'), { tags: ['tasks'] });
      render() { return <i>{() => this.tasks()}</i>; }
    }
    class Count extends Component {
      count = this.resource(load('count'), { tags: ['tasks', 'projects'] });
      other = this.resource(load('users'), { tags: ['users'] });
      plain = this.resource(load('plain'));
      render() { return <b>{() => this.count()}</b>; }
    }
    let shared!: Resource<string>;
    class Page extends Presenter {
      override startup() {
        shared = this.app.resource(load('app'), { tags: ['projects'] });
      }
      render() { return <main><List /><Count /></main>; }
    }
    const { app } = await boot(Page);
    await tick();
    expect(calls.sort()).toEqual(['app', 'count', 'list', 'plain', 'users']);
    calls.length = 0;

    app.invalidate('tasks');
    await tick();
    expect(calls.sort()).toEqual(['count', 'list']);
    calls.length = 0;

    app.invalidate('projects', 'users');
    await tick();
    expect(calls.sort()).toEqual(['app', 'count', 'users']);
    expect(shared()).toBe('app');
  });
});
