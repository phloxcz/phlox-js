// The documentation of PhloxJS: an application on the framework, pages in markdown with live demos.
import 'phlox-js/styles/base.css';
import { Application, BootstrapTheme, Container, Theme, setTexts } from 'phlox-js';
import cs from 'phlox-js/locales/cs';
import { bootstrap, startAppearance } from '../shared/appearance';
import { DocsPresenter } from './DocsPresenter';

// Texts of the framework in Czech, like the documentation
setTexts(cs);

// The look of the demos: Bootstrap with its theme, or the default theme of phlox-js; light or dark
startAppearance();
if (bootstrap) await import('bootstrap/dist/css/bootstrap.min.css');
else await import('phlox-js/styles/default.css');
await import('./docs.css');

const app = new Application(new Container().add(bootstrap ? new BootstrapTheme() : new Theme()));
app.formatTitle = title => (title ? `${title} – PhloxJS` : 'PhloxJS');
app.onError = error => {
  console.error(error);
  app.flashes.add(error instanceof Error ? error.message : String(error), 'error');
};

void app.run(DocsPresenter, document.getElementById('app')!);
