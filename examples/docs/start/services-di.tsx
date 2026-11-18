import { Button, Component, state } from '@phloxcz/phlox-js';
import type { Container } from '@phloxcz/phlox-js';

/** A service: one instance for the whole application, found by its type. */
class Greeter {
  private count = 0;

  public greet(name: string): string {
    this.count++;
    return `Ahoj, ${name}! (pozdrav číslo ${this.count})`;
  }
}

/** Registered like in config.neon; the documentation calls this before it shows the demo. */
export function services(container: Container) {
  container.add(Greeter);
}

/** The component writes what it needs into its constructor, the Vite plugin wires it. */
export default class Greeting extends Component {
  public readonly text = state('');

  public constructor(private greeter: Greeter) {
    super();
  }

  public render() {
    return (
      <p>
        <Button onClick={() => this.text.set(this.greeter.greet('Jano'))}>Pozdravit</Button>{' '}
        {this.text}
      </p>
    );
  }
}
