import { Button, Component, allowsMotion, motion, setMotion, state } from 'phlox-js';
import type { Motion } from 'phlox-js';

/** Buttons with the classes of the theme, and the one switch of animations. Switch the look in the header. */
export default class Looks extends Component {
  readonly open = state(false);

  render() {
    return (
      <div>
        <p style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
          <Button>Zrušit</Button>
          <Button primary>Uložit</Button>
          <Button danger>Smazat</Button>
          <Button small>Malé</Button>
          <Button primary disabled>Zakázané</Button>
        </p>
        <p>
          <label>
            Animace{' '}
            <select onChange={event => setMotion(event.currentTarget.value as Motion)}>
              {(['system', 'on', 'off'] as Motion[]).map(value => <option value={value} selected={() => motion() === value}>{value}</option>)}
            </select>
          </label>{' '}
          teď {() => (allowsMotion() ? 'animuje' : 'neanimuje')}{' '}
          <Button small onClick={() => this.open.update(open => !open)}>Posunout</Button>
        </p>
        {/* An own animation: its length multiplied by --phlox-motion (1 or 0) */}
        <div style={() => ({
          width: '3rem', height: '1.5rem', borderRadius: '6px', background: 'currentColor',
          transform: this.open() ? 'translateX(12rem)' : 'none', transition: 'transform calc(.5s * var(--phlox-motion))',
        })} />
      </div>
    );
  }
}
