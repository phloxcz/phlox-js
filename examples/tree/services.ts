// Services of the example, the counterpart of `services` in config.neon.
import { BootstrapTheme, Container } from 'phlox-js';
import { CategoryStore } from './model/CategoryStore';

import { bootstrap } from '../shared/appearance';

export const services = new Container().add(CategoryStore);

if (bootstrap) services.add(new BootstrapTheme());
