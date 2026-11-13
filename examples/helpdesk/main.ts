// The helpdesk example: projects, tasks and their detail against a mock JSON-RPC server (server/).
import 'phlox-js/styles/base.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './helpdesk.css';
import { Application, messageTexts } from 'phlox-js';
import { DropDownList, Form, UploadControl } from 'phlox-js/forms';
import { RpcError, RpcErrorCode } from 'phlox-js/net';
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
