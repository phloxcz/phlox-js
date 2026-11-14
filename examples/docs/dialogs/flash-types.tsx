import { Button, Component } from '@phloxcz/phlox-js';

/** Flash messages as toasts: four types, a title, an own duration. Errors stay until closed. */
export default class Flashes extends Component {
  render() {
    const flash = this.app.flashes;
    return (
      <p style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
        <Button onClick={() => flash.add('Informace.', 'info')}>info</Button>
        <Button onClick={() => flash.add('Uloženo.', 'success')}>success</Button>
        <Button onClick={() => flash.add('Pozor na to.', 'warning')}>warning</Button>
        <Button onClick={() => flash.add('Něco se nepovedlo.', 'error')}>error</Button>
        <Button onClick={() => flash.add('Objednávka odeslána.', 'success', { title: 'Hotovo' })}>s titulkem</Button>
        <Button onClick={() => flash.add('Jen na chvíli.', 'info', { duration: 1500 })}>1,5 s</Button>
      </p>
    );
  }
}
