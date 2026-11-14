// The helpdesk example: projects, tasks and their detail against a mock JSON-RPC server (server/).
import 'phlox-js/styles/base.css';
// Bootstrap is imported at the top of helpdesk.css: in the build the order of separate imports is not kept
import './helpdesk.css';
import { Application, setTexts } from 'phlox-js';
import cs from 'phlox-js/locales/cs';
import { Form } from 'phlox-js/forms';
import { RpcError, RpcErrorCode } from 'phlox-js/net';
import { registerSW } from 'virtual:pwa-register';
import { createServices } from './services';
import { AppPresenter } from './presenters/AppPresenter';

// Texts of the framework in Czech; single ones can still be changed
setTexts(cs);
Form.messages.set(Form.Filled, 'Vyplňte pole %label.');

const app = new Application(createServices());
// The site of examples runs the helpdesk under its own path, next to the documentation at /
app.basePath = '/helpdesk';

app.onError = error => {
  // The token is not valid any more, e.g. the mock server has started again
  if (error instanceof RpcError && error.code === RpcErrorCode.Unauthorized) {
    app.user.logout();
    void app.router.navigate(`${app.basePath}/sign`);
    return;
  }
  console.error(error);
  app.flashes.add(error instanceof Error ? error.message : String(error), 'error');
};

void app.run(AppPresenter, document.getElementById('app')!);

// PWA: the service worker keeps the application for offline; a new version is offered, not forced
const updateServiceWorker = registerSW({
  onOfflineReady: () => app.flashes.add('Aplikace je připravená i pro práci bez signálu.', 'success'),
  onNeedRefresh: async () => {
    if (await app.confirm('Je dostupná nová verze aplikace. Načíst ji?', { okText: 'Načíst', cancelText: 'Později' })) {
      void updateServiceWorker(true);
    }
  },
});
