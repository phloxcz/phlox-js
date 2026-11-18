import { Button, Component, computed, state } from '@phloxcz/phlox-js';

/** A state, a computed value from it, and a template that follows both. */
export default class Counter extends Component {
  public readonly count = state(0);
  public readonly double = computed(() => this.count() * 2);

  public render() {
    return (
      <p>
        <Button onClick={() => this.count.update(n => n - 1)}>−</Button>{' '}
        <strong>{this.count}</strong>{' '}
        <Button onClick={() => this.count.update(n => n + 1)}>+</Button>{' '}
        dvojnásobek: {this.double}
      </p>
    );
  }
}
