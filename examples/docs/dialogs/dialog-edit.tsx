import { Button, Component, state } from 'phlox-js';

/** A component for a dialog: its title, its buttons, and close(result). The result type is the second type parameter. */
class NameEdit extends Component<{ name: string }, string> {
  readonly name = state(this.props.name);

  override title() {
    return 'Úprava jména';
  }

  override actions() {
    return <>
      <Button onClick={() => this.close()}>Zrušit</Button>
      <Button primary onClick={() => this.close(this.name())}>Uložit</Button>
    </>;
  }

  render() {
    return (
      <label>
        Jméno{' '}
        <input value={this.name} onInput={event => this.name.set(event.currentTarget.value)}
          onKeydown={event => event.key === 'Enter' && this.close(this.name())} />
      </label>
    );
  }
}

/** openDialog() waits for the dialog and returns its result; the same component in a side panel. */
export default class Dialogs extends Component {
  readonly name = state('Jana Nováková');

  async edit(placement: 'center' | 'end') {
    const name = await this.openDialog(NameEdit, { name: this.name() }, { placement });
    if (name !== undefined) this.name.set(name);
  }

  render() {
    return (
      <p>
        Jméno: <strong>{this.name}</strong>{' '}
        <Button onClick={() => this.edit('center')}>Upravit v okně</Button>{' '}
        <Button onClick={() => this.edit('end')}>Upravit v panelu</Button>
      </p>
    );
  }
}
