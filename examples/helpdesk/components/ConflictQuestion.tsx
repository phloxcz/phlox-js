import { Button, Component } from 'phlox-js';
import type { OfflineChange } from 'phlox-js/net';
import { ago } from '../format';

/**
 * A change made offline whose record changed on the server meanwhile. The user sends it anyway or drops it;
 * Escape or × only puts the decision off, the change stays in the menu of waiting changes.
 */
export class ConflictQuestion extends Component<{ change: OfflineChange }, 'send' | 'drop'> {
  override title() {
    return 'Záznam se mezitím změnil';
  }

  override actions() {
    return <>
      <Button danger onClick={() => this.close('drop')}>Zahodit moji změnu</Button>
      <Button primary onClick={() => this.close('send')}>Uložit i tak</Button>
    </>;
  }

  render() {
    const { change } = this.props;
    return (
      <div>
        <p><strong>{change.title}</strong> ({ago(change.made)}, offline)</p>
        <p>Záznam na serveru mezitím změnil někdo jiný. Uložením přepíšete jeho změnu vaší.</p>
      </div>
    );
  }
}
