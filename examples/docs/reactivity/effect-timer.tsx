import { Component, effect, state } from '@phloxcz/phlox-js';

/** An effect with its own cleanup: the timer starts again whenever the delay changes. */
export default class Timer extends Component {
  readonly delay = state(1000);
  readonly ticks = state(0);

  constructor() {
    super();
    effect(() => {
      const timer = setInterval(() => this.ticks.update(n => n + 1), this.delay());
      return () => clearInterval(timer);
    });
  }

  render() {
    return (
      <p>
        <label>
          Interval{' '}
          <select onChange={event => this.delay.set(Number(event.currentTarget.value))}>
            <option value="1000">1 s</option>
            <option value="250">0,25 s</option>
            <option value="3000">3 s</option>
          </select>
        </label>{' '}
        Tiků: <strong>{this.ticks}</strong>
      </p>
    );
  }
}
