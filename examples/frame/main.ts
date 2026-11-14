// A demo of the documentation that is a presenter: it runs here, in a frame of its page, at /frame/<section>/<demo>/…,
// with routes of its own. The bar at the top shows its address, so it is seen how links and dialogs change it.
import '@phloxcz/phlox-js/styles/base.css';
import { Application, BootstrapTheme, Container, Theme, setTexts } from '@phloxcz/phlox-js';
import cs from '@phloxcz/phlox-js/locales/cs';
import { bootstrap, startAppearance } from '../shared/appearance';
import { isPresenter } from '../docs/page';
import type { DemoModule } from '../docs/page';
import './frame.css';

setTexts(cs);

const DEMOS = import.meta.glob<DemoModule>(['../docs/*/*.tsx', '!../docs/*/_*.tsx']);
const [, , section, name] = location.pathname.split('/');
const basePath = `/frame/${section}/${name}`;
const load = DEMOS[`../docs/${section}/${name}.tsx`];
if (!load) throw new Error(`The demo ${section}/${name} does not exist.`);
const module = await load();
if (!isPresenter(module.default)) throw new Error(`The demo ${section}/${name} is not a presenter.`);

// The look chosen in the header of the documentation
startAppearance();
if (bootstrap) await import('bootstrap/dist/css/bootstrap.min.css');
else await import('@phloxcz/phlox-js/styles/default.css');

const services = new Container().add(bootstrap ? new BootstrapTheme() : new Theme());
module.services?.(services);
const app = new Application(services);
app.basePath = basePath;
app.onError = error => {
  console.error(error);
  app.flashes.add(error instanceof Error ? error.message : String(error), 'error');
};

// The address within the demo, after every change of it
const bar = document.querySelector<HTMLElement>('.frame-url')!;
const showUrl = () => {
  bar.textContent = (location.pathname.slice(basePath.length) || '/') + location.search;
  bar.dataset.title = document.title;
};
// The title of the page too, pageTitle() of presenters
new MutationObserver(showUrl).observe(document.head, { subtree: true, childList: true, characterData: true });
for (const method of ['pushState', 'replaceState'] as const) {
  const original = history[method].bind(history);
  history[method] = (...args: Parameters<History['pushState']>) => {
    original(...args);
    showUrl();
  };
}
addEventListener('popstate', showUrl);
showUrl();

void app.run(module.default, document.getElementById('app')!);
