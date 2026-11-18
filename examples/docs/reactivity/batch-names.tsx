import { Button, Component, batch, computed, effect, state } from '@phloxcz/phlox-js';

/** Two changes in one batch: the effect runs once, not with a half-changed name. */
export default class Names extends Component {
  public readonly first = state('Jan');
  public readonly last = state('Novák');
  public readonly full = computed(() => `${this.first()} ${this.last()}`);
  public readonly log = state<string[]>([]);

  public constructor() {
    super();
    effect(() => {
      const name = this.full();
      this.log.update(log => [...log.slice(-4), name]);
    });
  }

  public render() {
    return (
      <div>
        <Button onClick={() => { this.first.set('Eva'); this.last.set('Dvořáková'); }}>Bez batch</Button>{' '}
        <Button onClick={() => batch(() => { this.first.set('Petr'); this.last.set('Svoboda'); })}>S batch</Button>
        <p>Efekt viděl: {() => this.log().join(' → ')}</p>
      </div>
    );
  }
}
