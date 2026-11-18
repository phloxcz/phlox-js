import { Component, For, state, untrack } from '@phloxcz/phlox-js';
import type { Child } from '@phloxcz/phlox-js';
import { Form, FormControl, FormView } from '@phloxcz/phlox-js/forms';
import type { ExtraAttributes } from '@phloxcz/phlox-js/forms';

/** An own control: stars from 1 to 5, the value is a number or null. */
class RatingControl extends FormControl<number | null> {
  private readonly current = state<number | null>(null);

  public getValue(): number | null {
    return this.current();
  }

  public setValue(value: number | null): void {
    this.current.set(value);
  }

  public isFilled(): boolean {
    return this.current() !== null;
  }

  public render(attributes: ExtraAttributes): Child {
    const { id, onBlur } = this.attrs();
    return (
      <span id={id as string} role="radiogroup" aria-label={this.label} class={this.classFor(attributes, 'rating')}
        onFocusout={onBlur as (event: FocusEvent) => void} ref={element => { this.element = element; }}>
        <For each={() => [1, 2, 3, 4, 5]}>
          {stars => (
            <button type="button" role="radio" aria-checked={() => String(this.current() === stars)} aria-label={`${stars} z 5`}
              style={{ font: 'inherit', fontSize: '1.4rem', background: 'none', border: '0', cursor: 'pointer', padding: '0 .1rem' }}
              onClick={() => {
                this.current.set(untrack(this.current) === stars ? null : stars);
                this.changed();   // a change by the user: the rules are checked as with other controls
              }}>
              {() => ((this.current() ?? 0) >= stars ? '★' : '☆')}
            </button>
          )}
        </For>
      </span>
    );
  }
}

interface Review { rating: number | null; text: string }

/** Rules, <Label>, errors and values work as with the controls of the framework. */
export default class ReviewForm extends Component {
  public readonly form = new Form<Review>();
  public readonly result = state('');

  public constructor() {
    super();
    this.form.addControl('rating', new RatingControl('Hodnocení')).setRequired('Vyberte počet hvězd.');
    this.form.addTextArea('text', 'Recenze');
    this.form.addSubmit('send', 'Odeslat');
    this.form.onSuccess = values => this.result.set(JSON.stringify(values));
  }

  public render() {
    return <div><FormView form={this.form} /><p><code>{this.result}</code></p></div>;
  }
}
