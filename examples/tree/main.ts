// The tree example: a shop's categories, loaded level by level, selected by the URL, moved by dragging.
import 'phlox-js/styles/base.css';
import { Application } from 'phlox-js';
import { Tree } from 'phlox-js/components';
import { bootstrap, startAppearance } from '../shared/appearance';
import { services } from './services';
import { CategoriesPresenter } from './presenters/CategoriesPresenter';

// The look chosen by the user: theme, light or dark, animations
startAppearance();
if (bootstrap) await import('bootstrap/dist/css/bootstrap.min.css');
else await import('phlox-js/styles/default.css');

Tree.texts = { expand: 'Rozbalit', collapse: 'Sbalit', loading: 'Načítám…' };

const app = new Application(services);

app.onError = error => {
  console.error(error);
  app.flashes.add(error instanceof Error ? error.message : String(error), 'error', { duration: 0 });
};

void app.run(CategoriesPresenter, document.getElementById('app')!);
