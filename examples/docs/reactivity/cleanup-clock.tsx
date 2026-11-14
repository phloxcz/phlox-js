import { Button, Component, If, onCleanup, state } from '@phloxcz/phlox-js';

/** A function component with its own cleanup: the timer stops when its branch goes away. */
function Clock() {
  const now = state(new Date());
  const timer = setInterval(() => now.set(new Date()), 1000);
  onCleanup(() => clearInterval(timer));
  return <time>{() => now().toLocaleTimeString('cs')}</time>;
}

export default class Cleanup extends Component {
  readonly shown = state(true);

  render() {
    return (
      <p>
        <Button onClick={() => this.shown.update(shown => !shown)}>{() => (this.shown() ? 'Skrýt' : 'Ukázat')}</Button>{' '}
        <If when={this.shown}><Clock /></If>
      </p>
    );
  }
}
