import { Button, Component, computed, state } from '@phloxcz/phlox-js';

/** A state, a computed value from it, and a template that follows both. */
export default class Counter extends Component {
  readonly count = state(0);
  readonly double = computed(() => this.count() * 2);

  render() {
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
