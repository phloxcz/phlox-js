import { Button, Component, state } from '@phloxcz/phlox-js';

/** alert, confirm and prompt as dialogs of the application, confirm as a popover by its button, loading. */
export default class Messages extends Component {
  public readonly result = state('');

  public async ask() {
    const yes = await this.confirm('Smazat položku?', { danger: true, okText: 'Smazat' });
    this.result.set(`confirm: ${yes}`);
  }

  public async rename() {
    const name = await this.prompt('Nový název:', { value: 'Mléko', placeholder: 'název' });
    this.result.set(`prompt: ${JSON.stringify(name)}`);
  }

  public async askHere(button: HTMLElement) {
    const yes = await this.confirm('Opravdu?', { anchor: button, danger: true, okText: 'Ano' });
    this.result.set(`popover: ${yes}`);
  }

  public async save() {
    const loading = this.showLoading('Ukládám…');
    for (let step = 1; step <= 3; step++) {
      await new Promise(resolve => setTimeout(resolve, 600));
      loading.update(`Ukládám ${step} z 3…`);
    }
    loading.close();
    await this.alert('Uloženo.');
  }

  public render() {
    return (
      <div>
        <p style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
          <Button onClick={() => this.alert('Toto je alert.', { title: 'Upozornění' })}>alert</Button>
          <Button onClick={() => this.ask()}>confirm</Button>
          <Button onClick={() => this.rename()}>prompt</Button>
          <Button onClick={event => this.askHere(event.currentTarget)}>confirm u tlačítka</Button>
          <Button onClick={() => this.save()}>showLoading</Button>
        </p>
        <p><code>{this.result}</code></p>
      </div>
    );
  }
}
