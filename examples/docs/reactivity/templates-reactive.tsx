import { Button, Component, state } from '@phloxcz/phlox-js';

/** What is a state or a function follows changes; a value read in the template is read once. */
export default class Reactive extends Component {
  public readonly count = state(1);

  public render() {
    return (
      <div>
        <Button onClick={() => this.count.update(n => n + 1)}>Přidat</Button>
        <ul>
          <li><code>{'{count}'}</code>: <strong>{this.count}</strong></li>
          <li><code>{'{() => count() * 2}'}</code>: <strong>{() => this.count() * 2}</strong></li>
          <li><code>{'{count() * 2}'}</code>: <strong>{this.count() * 2}</strong> (přečteno jednou, nemění se)</li>
        </ul>
      </div>
    );
  }
}
