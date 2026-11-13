// The Kendo UI example: Kendo Grid, Kendo widgets in forms and dialogs in Kendo Window, through phlox-js/adapters/kendo.
import 'bootstrap/dist/css/bootstrap.min.css';
import '@progress/kendo-theme-bootstrap/dist/bootstrap-main.css';
import 'phlox-js/styles/base.css';
import 'phlox-js/adapters/kendo/kendo.css';
import jQuery from 'jquery';
import { setScriptKey } from '@progress/kendo-licensing';
import { Application, messageTexts } from 'phlox-js';
import { showExampleMenu } from '../shared/menu';
import { createServices } from './services';
import { OrdersPresenter } from './presenters/OrdersPresenter';

// The license key of Kendo UI, from .env.local (VITE_KENDO_LICENSE=...), never in git. Without it Kendo shows a trial notice.
const license = import.meta.env.VITE_KENDO_LICENSE as string | undefined;
if (license) setScriptKey(license);

// Kendo looks for jQuery in window, so it is set before Kendo is imported
Object.assign(window, { jQuery, $: jQuery });
const { default: kendo } = await import('@progress/kendo-ui');
// @ts-expect-error A file without types; TypeScript resolves it to the global typings of Kendo, which are no module
await import('@progress/kendo-ui/esm/cultures/kendo.culture.cs-CZ.js');
kendo.culture('cs-CZ');

Object.assign(messageTexts, {
  ok: 'OK', cancel: 'Zrušit', close: 'Zavřít', loading: 'Načítám…', unsaved: 'Odejít bez uložení změn?', leave: 'Odejít',
});

const app = new Application(createServices(kendo));
app.basePath = showExampleMenu();
app.onError = error => {
  console.error(error);
  app.flashes.add(error instanceof Error ? error.message : String(error), 'error');
};

void app.run(OrdersPresenter, document.getElementById('app')!);
