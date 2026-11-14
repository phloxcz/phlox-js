import { Component, state } from '@phloxcz/phlox-js';

/** Events, a live attribute, the element through ref, and SVG right in the template. */
export default class Events extends Component {
  readonly draft = state('');

  render() {
    return (
      <div>
        <input value={this.draft} placeholder="Pište…" onInput={event => this.draft.set(event.currentTarget.value)} />
        <p style={() => ({ color: this.draft().length > 10 ? 'crimson' : 'inherit' })}>
          {() => this.draft().length} znaků
        </p>
        <svg viewBox="0 0 100 10" width="200" height="20" aria-hidden="true">
          <rect width={() => Math.min(100, this.draft().length * 5)} height="10" fill="currentColor" />
        </svg>
      </div>
    );
  }
}
