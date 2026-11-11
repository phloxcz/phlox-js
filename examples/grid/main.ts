// The grid example: orders with sorting, search, filters, pages, actions and totals; the state is in the URL.
import 'phlox-js/styles/base.css';
import { Application, messageTexts } from 'phlox-js';
import { Grid } from 'phlox-js/components';
import { DropDownList } from 'phlox-js/forms';
import { bootstrap, startAppearance } from '../shared/appearance';
import { showExampleMenu } from '../shared/menu';
import { services } from './services';
import { OrdersPresenter } from './presenters/OrdersPresenter';

// The look chosen by the user: theme, light or dark, animations
startAppearance();
if (bootstrap) await import('bootstrap/dist/css/bootstrap.min.css');
else await import('phlox-js/styles/default.css');

Grid.texts = {
  ...Grid.texts,
  search: 'Hledat…', reset: 'Zrušit filtry', filter: 'Filtr', all: 'Vše', yes: 'Ano', no: 'Ne', apply: 'Použít',
  from: 'Od', to: 'Do', clearFilter: 'Zrušit filtr', noData: 'Žádné záznamy', loading: 'Načítám…',
  shown: '%d–%d z %d', perPage: 'Řádků na stránku', first: 'První stránka', previous: 'Předchozí stránka',
  next: 'Další stránka', last: 'Poslední stránka', page: 'Stránka %d', columns: 'Sloupce', moveLeft: 'Posunout vlevo',
  moveRight: 'Posunout vpravo', selected: 'Vybráno: %d', selectAll: 'Vybrat vše na stránce', selectRow: 'Vybrat řádek',
  actions: 'Akce', sortBy: 'Řadit podle %s', resize: 'Změnit šířku sloupce %s',
  sum: 'Celkem', avg: 'Průměr', count: 'Počet', min: 'Nejméně', max: 'Nejvíc',
};

Object.assign(messageTexts, { ok: 'OK', cancel: 'Zrušit', close: 'Zavřít', loading: 'Načítám…' });
DropDownList.texts.filterPlaceholder = 'Hledat…';
DropDownList.texts.noResults = 'Nic nenalezeno';

const app = new Application(services);
// All examples run as one site, this one under its own path, see examples/shared/menu.ts
app.basePath = showExampleMenu();

app.onError = error => {
  console.error(error);
  app.flashes.add(error instanceof Error ? error.message : String(error), 'error', { duration: 0 });
};

void app.run(OrdersPresenter, document.getElementById('app')!);
