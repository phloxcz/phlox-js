import { Button, Component, batch, computed, effect, state } from '@phloxcz/phlox-js';

/** Two changes in one batch: the effect runs once, not with a half-changed name. */
export default class Names extends Component {
  readonly first = state('Jan');
  readonly last = state('Novák');
  readonly full = computed(() => `${this.first()} ${this.last()}`);
  readonly log = state<string[]>([]);

  constructor() {
    super();
    effect(() => {
      const name = this.full();
      this.log.update(log => [...log.slice(-4), name]);
    });
  }

  render() {
    return (
      <div>
        <Button onClick={() => { this.first.set('Eva'); this.last.set('Dvořáková'); }}>Bez batch</Button>{' '}
        <Button onClick={() => batch(() => { this.first.set('Petr'); this.last.set('Svoboda'); })}>S batch</Button>
        <p>Efekt viděl: {() => this.log().join(' → ')}</p>
      </div>
    );
  }
}
