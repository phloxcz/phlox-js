import { Button, For, Presenter, state } from '@phloxcz/phlox-js';
import type { Route } from '@phloxcz/phlox-js';

interface Item { id: number; name: string; history: string[] }

const items: Item[] = [
  { id: 1, name: 'Mléko', history: ['založeno', 'přejmenováno'] },
  { id: 2, name: 'Chléb', history: ['založeno'] },
];

/** /1/history/0: the third level, a detail of one change. */
class ChangeDetail extends Presenter<{ item: Item; index: number }> {
  public override title() {
    return `Změna ${this.props.index + 1}`;
  }

  public render() {
    return <p>{this.props.item.history[this.props.index]}</p>;
  }
}

/** /1/history: a dialog over the edit, with routes of its own. */
class ItemHistory extends Presenter<{ item: Item }> {
  public override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'change', pattern: '/<index:int>', dialog: ({ index }) => [ChangeDetail, { item: this.props.item, index: Number(index) }] },
  ];

  public override title() {
    return `Historie: ${this.props.item.name}`;
  }

  public render() {
    return (
      <ul>
        <For each={() => this.props.item.history}>
          {(change, index) => <li><a href={this.link('change', { index: index() })}>{change}</a></li>}
        </For>
      </ul>
    );
  }
}

/** /1: the edit is a presenter too, so it can open a dialog over itself. */
class ItemEdit extends Presenter<{ item: Item }, boolean> {
  public readonly name = state(this.props.item.name);

  public override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'history', pattern: '/history', dialog: () => [ItemHistory, { item: this.props.item }] },
  ];

  public override title() {
    return 'Úprava položky';
  }

  public override actions() {
    return <>
      <Button onClick={() => this.close(false)}>Zrušit</Button>
      <Button primary onClick={() => this.save()}>Uložit</Button>
    </>;
  }

  public save() {
    this.props.item.name = this.name();
    this.props.item.history.push(`přejmenováno na ${this.name()}`);
    this.close(true);
  }

  public render() {
    return (
      <div>
        <input value={this.name} onInput={event => this.name.set(event.currentTarget.value)} />
        <p><a href={this.link('history')}>Historie změn</a></p>
      </div>
    );
  }
}

/** A dialog with a URL: links lead to it, Back closes it, closed() gets its result. */
export default class ItemsPresenter extends Presenter {
  public readonly items = state([...items]);

  public override routes: Route[] = [
    { name: 'default', pattern: '/' },
    {
      name: 'edit',
      pattern: '/<id:int>',
      dialog: ({ id }) => [ItemEdit, { item: items.find(item => item.id === Number(id))! }],
      closed: saved => {
        if (saved) this.items.set([...items]);
      },
    },
  ];

  public render() {
    return (
      <ul>
        <For each={this.items}>
          {item => <li>{item.name} <a href={this.link('edit', { id: item.id })}>upravit</a></li>}
        </For>
      </ul>
    );
  }
}
