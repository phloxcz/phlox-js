import { Button, Component, Else, ElseIf, If, state } from '@phloxcz/phlox-js';

interface Profile { name: string }

/** Three branches; only the shown one exists, the value of the condition is passed to the first one. */
export default class Branches extends Component {
  public readonly profile = state<Profile | null>(null);
  public readonly signingIn = state(false);

  public signIn() {
    this.signingIn.set(true);
    setTimeout(() => {
      this.signingIn.set(false);
      this.profile.set({ name: 'Jana Nováková' });
    }, 800);
  }

  public render() {
    return (
      <If when={this.profile}>
        {profile => <p>Přihlášena: <strong>{() => profile().name}</strong> <Button onClick={() => this.profile.set(null)}>Odhlásit</Button></p>}
      <ElseIf when={this.signingIn} />
        <p>Přihlašuji…</p>
      <Else />
        <Button primary onClick={() => this.signIn()}>Přihlásit</Button>
      </If>
    );
  }
}
