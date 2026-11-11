// Bootstrap: styles, services from services.ts, the root presenter and the element to show it in.
import 'phlox-js/styles/base.css';
import { Application } from 'phlox-js';
import { bootstrap, services } from './services';
import { AppPresenter } from './presenters/AppPresenter';

// The look: Bootstrap with its theme, or the default theme of phlox-js
if (bootstrap) await import('bootstrap/dist/css/bootstrap.min.css');
else await import('phlox-js/styles/default.css');

const app = new Application(services);

app.onError = error => {
  console.error(error);
  app.flashes.add(error instanceof Error ? error.message : String(error), 'error');
};

void app.run(AppPresenter, document.getElementById('app')!);
