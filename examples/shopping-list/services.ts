// Services of the application, the counterpart of `services` in config.neon.
import { BootstrapTheme, Container } from 'phlox-js';
import { ShoppingStore } from './model/ShoppingStore';
import { translator } from './i18n';

import { bootstrap } from '../shared/appearance';

export const services = new Container()
  .add(ShoppingStore, translator);

// Without a theme in the container the default one is used
if (bootstrap) services.add(new BootstrapTheme());
