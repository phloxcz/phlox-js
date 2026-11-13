// The helpdesk example: projects, tasks and their detail against a mock JSON-RPC server (server/).
import 'phlox-js/styles/base.css';
// Bootstrap is imported at the top of helpdesk.css: in the build the order of separate imports is not kept
import './helpdesk.css';
import { Application, messageTexts } from 'phlox-js';
import { DropDownList, Form, UploadControl } from 'phlox-js/forms';
import { RpcError, RpcErrorCode } from 'phlox-js/net';
import { registerSW } from 'virtual:pwa-register';
import { showExampleMenu } from '../shared/menu';
import { createServices } from './services';
import { AppPresenter } from './presenters/AppPresenter';

Object.assign(messageTexts, {
  ok: 'OK', cancel: 'Zrušit', close: 'Zavřít', loading: 'Načítám…', unsaved: 'Odejít bez uložení změn?', leave: 'Odejít',
});
DropDownList.texts.filterPlaceholder = 'Hledat…';
DropDownList.texts.noResults = 'Nic nenalezeno';
UploadControl.texts.heading = 'Přetáhněte soubory sem';
Form.messages.set(Form.Filled, 'Vyplňte pole %label.');

const app = new Application(createServices());
// All examples run as one site, this one under its own path, see examples/shared/menu.ts
app.basePath = showExampleMenu();

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
