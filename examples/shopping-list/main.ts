// Bootstrap: services from services.ts, the root presenter and the element to show it in.
import { Application } from 'phlox-js';
import { services } from './services';
import { AppPresenter } from './presenters/AppPresenter';

const app = new Application(services);

app.onError = error => {
  console.error(error);
  app.flashes.add(error instanceof Error ? error.message : String(error), 'error');
};

void app.run(AppPresenter, document.getElementById('app')!);
