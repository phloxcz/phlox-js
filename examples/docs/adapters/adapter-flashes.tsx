import { Button, FlashMessages, For, Presenter, state } from 'phlox-js';
import type { Container, Flash, FlashOptions } from 'phlox-js';

/** An adapter: another service for flash messages, here a log line instead of toasts. */
class LogFlashMessages extends FlashMessages {
  readonly log = state<string[]>([]);

  override add(text: string, type = 'info', options: FlashOptions = {}): Flash {
    const time = new Date().toLocaleTimeString('cs');
    this.log.update(log => [`${time} [${type}] ${options.title ? `${options.title}: ` : ''}${text}`, ...log].slice(0, 5));
    return { text, type, duration: 0 };
  }
}

/** Registered in services.ts, the framework uses it instead of the default one; presenters stay the same. */
export function services(container: Container) {
  container.add(LogFlashMessages);
}

export default class AdapterDemo extends Presenter {
  render() {
    const flashes = this.app.flashes as LogFlashMessages;
    return (
      <div>
        <p style={{ display: 'flex', gap: '.5rem' }}>
          <Button onClick={() => this.flashMessage('Uloženo.', 'success')}>flashMessage()</Button>
          <Button onClick={() => this.flashMessage('Něco se nepovedlo.', 'error', { title: 'Chyba' })}>Chyba</Button>
        </p>
        <ul><For each={flashes.log}>{line => <li><code>{line}</code></li>}</For></ul>
      </div>
    );
  }
}
